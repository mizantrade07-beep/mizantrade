const Order = require("../models/Order");
const { buildSeo } = require("../utils/seo");
const { sendSms, normalizePhone } = require("../utils/sms");
const { orderStatusText } = require("../utils/smsTemplates");

/* ট্র্যাকিং টাইমলাইনের ধাপসমূহ (বর্তমান স্ট্যাটাস পর্যন্ত আলোকিত) */
const TRACKING_STEPS = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered"];

/* ======================================================
   HISTORY REPORT HELPERS
====================================================== */

const HISTORY_TZ = "Asia/Dhaka";

const ORDER_STATUSES = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled"
];

const PAYMENT_LABELS = {
    bkash: "bKash",
    nagad: "Nagad",
    rocket: "Rocket",
    bank: "Bank Transfer",
    cod: "Cash on Delivery"
};

const PAYMENT_METHOD_ORDER = ["bkash", "nagad", "rocket", "bank", "cod"];

function parseDateBoundary(value, endOfDay) {
    const v = String(value || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return null;
    }

    const date = new Date(
        v + (endOfDay ? "T23:59:59.999+06:00" : "T00:00:00.000+06:00")
    );

    return isNaN(date.getTime()) ? null : date;
}

function dhakaDayKey(value) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: HISTORY_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date(value));

    const map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });

    return map.year + "-" + map.month + "-" + map.day;
}

function formatDayKey(key) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: HISTORY_TZ,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date(key + "T00:00:00+06:00"));
}

function formatTime(value) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: HISTORY_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    }).format(new Date(value));
}

function formatRangeLabel(from, to) {
    const fmt = function (v) {
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: HISTORY_TZ,
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(new Date(v + "T00:00:00+06:00"));
    };

    if (from && to) return fmt(from) + " – " + fmt(to);
    if (from) return "From " + fmt(from);
    if (to) return "Up to " + fmt(to);
    return "All time";
}

function groupOrdersByDay(orders) {
    const groups = [];
    const index = {};

    orders.forEach(function (order) {
        const key = dhakaDayKey(order.createdAt);

        if (!index[key]) {
            index[key] = {
                key: key,
                label: formatDayKey(key),
                orders: [],
                total: 0
            };
            groups.push(index[key]);
        }

        index[key].orders.push(order);
        index[key].total += Number(order.total) || 0;
    });

    return groups;
}

function safeRegex(value) {
    return new RegExp(
        String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
    );
}

function normalizeRange(fromInput, toInput) {
    let from = String(fromInput || "").trim();
    let to = String(toInput || "").trim();

    if (from && !parseDateBoundary(from, false)) from = "";
    if (to && !parseDateBoundary(to, true)) to = "";

    if (from && to && from > to) {
        const temp = from;
        from = to;
        to = temp;
    }

    return { from: from, to: to };
}

function buildDateFilter(fromInput, toInput) {
    const range = normalizeRange(fromInput, toInput);
    const filter = {};

    const fromDate = parseDateBoundary(range.from, false);
    const toDate = parseDateBoundary(range.to, true);

    if (fromDate || toDate) {
        filter.createdAt = {};
        if (fromDate) filter.createdAt.$gte = fromDate;
        if (toDate) filter.createdAt.$lte = toDate;
    }

    return { filter: filter, range: range };
}

function paymentAccount(order) {
    const info = order.paymentInfo || {};

    if (order.paymentMethod === "cod") {
        return {
            key: "cod",
            label: "Cash on Delivery",
            detail: ""
        };
    }

    if (order.paymentMethod === "bank") {
        const label = info.accountLabel || info.receiverAccountName || "Bank Account";
        const detail = [info.receiverBankName, info.receiverAccountNumber]
            .filter(Boolean)
            .join(" • ");

        return { key: "bank|" + label + "|" + detail, label: label, detail: detail };
    }

    const label = info.accountLabel || (PAYMENT_LABELS[order.paymentMethod] + " Account");
    const detail = info.receiverNumber || "";

    return {
        key: order.paymentMethod + "|" + label + "|" + detail,
        label: label,
        detail: detail
    };
}

/* ======================================================
   ADMIN - ORDER LIST
====================================================== */

exports.getOrders = async (req, res) => {
    try {
        const { status = "", search = "" } = req.query;

        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (search.trim()) {
            const regex = new RegExp(
                search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
            );

            filter.$or = [
                { orderNumber: regex },
                { "customer.name": regex },
                { "customer.phone": regex }
            ];
        }

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        return res.render("admin/orders", {
            pageTitle: "Orders",
            orders,
            status,
            search: search.trim()
        });
    } catch (error) {
        console.error("Admin order list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - ORDER HISTORY REPORT
====================================================== */

exports.getOrderHistory = async (req, res) => {
    try {
        const status = String(req.query.status || "").trim();
        const search = String(req.query.search || "").trim();

        const dateFilter = buildDateFilter(req.query.from, req.query.to);
        const filter = dateFilter.filter;

        if (ORDER_STATUSES.indexOf(status) !== -1) {
            filter.status = status;
        }

        if (search) {
            const regex = safeRegex(search);

            filter.$or = [
                { orderNumber: regex },
                { "customer.name": regex },
                { "customer.phone": regex }
            ];
        }

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        const summary = {
            count: orders.length,
            amount: 0,
            pcs: 0,
            delivered: 0,
            cancelled: 0
        };

        orders.forEach(function (order) {
            order.timeLabel = formatTime(order.createdAt);
            order.pcs = (order.items || []).reduce(function (sum, item) {
                return sum + (Number(item.quantity) || 0);
            }, 0);

            summary.amount += Number(order.total) || 0;
            summary.pcs += order.pcs;

            if (order.status === "Delivered") summary.delivered += 1;
            if (order.status === "Cancelled") summary.cancelled += 1;
        });

        return res.render("admin/orderHistory", {
            pageTitle: "Order History",
            orders: orders,
            days: groupOrdersByDay(orders),
            summary: summary,
            status: status,
            search: search,
            from: dateFilter.range.from,
            to: dateFilter.range.to,
            rangeLabel: formatRangeLabel(dateFilter.range.from, dateFilter.range.to),
            paymentLabels: PAYMENT_LABELS
        });
    } catch (error) {
        console.error("Order history error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - PAYMENT HISTORY REPORT
====================================================== */

exports.getPaymentHistory = async (req, res) => {
    try {
        const methodInput = String(req.query.method || "").trim();
        const method = PAYMENT_METHOD_ORDER.indexOf(methodInput) !== -1
            ? methodInput
            : "";

        const dateFilter = buildDateFilter(req.query.from, req.query.to);

        const filter = Object.assign({}, dateFilter.filter, {
            status: { $ne: "Cancelled" }
        });

        const found = await Order.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        // COD is only received once an order has been delivered.
        const paid = found.filter(function (order) {
            return order.paymentMethod !== "cod" || order.status === "Delivered";
        });

        const orders = method
            ? paid.filter(function (order) { return order.paymentMethod === method; })
            : paid;

        const sectionMap = {};
        const cardMap = {};
        const accountKeys = {};
        let grandTotal = 0;

        paid.forEach(function (order) {
            if (!cardMap[order.paymentMethod]) {
                cardMap[order.paymentMethod] = { total: 0, count: 0 };
            }

            cardMap[order.paymentMethod].total += Number(order.total) || 0;
            cardMap[order.paymentMethod].count += 1;
        });

        orders.forEach(function (order) {
            order.timeLabel = formatTime(order.createdAt);
            order.amount = Number(order.total) || 0;

            const account = paymentAccount(order);
            order.payAccount = account.label;
            order.payDetail = account.detail;

            let section = sectionMap[order.paymentMethod];

            if (!section) {
                section = {
                    key: order.paymentMethod,
                    label: PAYMENT_LABELS[order.paymentMethod],
                    orders: [],
                    accounts: [],
                    accountIndex: {},
                    total: 0
                };
                sectionMap[order.paymentMethod] = section;
            }

            section.orders.push(order);
            section.total += order.amount;

            let acc = section.accountIndex[account.key];

            if (!acc) {
                acc = {
                    label: account.label,
                    detail: account.detail,
                    total: 0,
                    count: 0
                };
                section.accountIndex[account.key] = acc;
                section.accounts.push(acc);
            }

            acc.total += order.amount;
            acc.count += 1;

            accountKeys[order.paymentMethod + "|" + account.key] = true;
            grandTotal += order.amount;
        });

        const sections = PAYMENT_METHOD_ORDER
            .map(function (key) { return sectionMap[key]; })
            .filter(Boolean)
            .map(function (section) {
                section.count = section.orders.length;
                section.days = groupOrdersByDay(section.orders);
                return section;
            });

        const dailyMap = {};
        const dailyTotals = {};

        orders.forEach(function (order) {
            const key = dhakaDayKey(order.createdAt);
            const amount = Number(order.total) || 0;

            if (!dailyMap[key]) {
                dailyMap[key] = {
                    key: key,
                    label: formatDayKey(key),
                    count: 0,
                    total: 0,
                    breakdown: []
                };
                dailyTotals[key] = {};
            }

            dailyMap[key].count += 1;
            dailyMap[key].total += amount;
            dailyTotals[key][order.paymentMethod] = (dailyTotals[key][order.paymentMethod] || 0) + amount;
        });

        const daily = Object.keys(dailyMap)
            .sort()
            .reverse()
            .map(function (key) {
                const row = dailyMap[key];

                row.breakdown = PAYMENT_METHOD_ORDER
                    .filter(function (m) { return dailyTotals[key][m]; })
                    .map(function (m) {
                        return {
                            label: PAYMENT_LABELS[m],
                            total: dailyTotals[key][m]
                        };
                    });

                return row;
            });

        const methodCards = PAYMENT_METHOD_ORDER.map(function (key) {
            const card = cardMap[key] || { total: 0, count: 0 };

            return {
                key: key,
                label: PAYMENT_LABELS[key],
                total: card.total,
                count: card.count,
                active: method === key
            };
        });

        return res.render("admin/paymentHistory", {
            pageTitle: "Payment History",
            sections: sections,
            daily: daily,
            methodCards: methodCards,
            summary: {
                total: grandTotal,
                count: orders.length,
                average: orders.length ? grandTotal / orders.length : 0,
                accounts: Object.keys(accountKeys).length
            },
            method: method,
            from: dateFilter.range.from,
            to: dateFilter.range.to,
            rangeLabel: formatRangeLabel(dateFilter.range.from, dateFilter.range.to)
        });
    } catch (error) {
        console.error("Payment history error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - ORDER DETAIL
====================================================== */

exports.getOrderDetail = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).lean();

        if (!order) {
            return res.status(404).send("Order not found.");
        }

        return res.render("admin/orderDetail", {
            pageTitle: "Order " + order.orderNumber,
            order
        });
    } catch (error) {
        console.error("Admin order detail error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - PRINTABLE DOCUMENTS (invoice / challans)
====================================================== */

const siteSettings = require("../utils/siteSettings");

const PRINT_DOCS = {
    "invoice": { label: "Invoice" },
    "delivery-challan": { label: "Delivery Challan" },
    "delivery-slip": { label: "Delivery Slip" },
    "packing-challan": { label: "Packing Challan" }
};

exports.getPrintDocument = async (req, res) => {
    try {
        const docKey = String(req.params.doc || "");

        if (!PRINT_DOCS[docKey]) {
            return res.status(404).send("Unknown document type.");
        }

        const order = await Order.findById(req.params.id).lean();

        if (!order) {
            return res.status(404).send("Order not found.");
        }

        const settings = await siteSettings.getSettingsDoc();

        return res.render("admin/print/orderDoc", {
            pageTitle: PRINT_DOCS[docKey].label + " " + order.orderNumber,
            order,
            docKey,
            docLabel: PRINT_DOCS[docKey].label,
            settings
        });
    } catch (error) {
        console.error("Print document error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - UPDATE ORDER STATUS
====================================================== */

exports.postUpdateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const allowed = [
            "Pending",
            "Confirmed",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        if (!allowed.includes(status)) {
            return res.status(400).send("Invalid status.");
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).send("Order not found.");
        }

        const previousStatus = order.status;
        order.status = status;
        await order.save();

        // Tell the customer only when the status actually changed.
        if (previousStatus !== status) {
            const phone = normalizePhone(order.customer && order.customer.phone);
            if (/^01[3-9]\d{8}$/.test(phone)) {
                const result = await sendSms(phone, orderStatusText(order));
                if (!result.ok) {
                    console.error(
                        "Order status SMS failed (" + order.orderNumber + "): code=" +
                        (result.code || "-") + " " + (result.error || result.body)
                    );
                }
            }
        }

        return res.redirect("/admin/order/" + req.params.id);
    } catch (error) {
        console.error("Update order status error:", error);
        return res.status(500).send("Unable to update status.");
    }
};

/* ======================================================
   ADMIN - DELETE ORDER
====================================================== */

exports.deleteOrder = async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        return res.redirect("/admin/orders");
    } catch (error) {
        console.error("Delete order error:", error);
        return res.status(500).send("Unable to delete order.");
    }
};

/* ======================================================
   PUBLIC - ORDER TRACKING
====================================================== */

function renderTracking(req, res, data) {
    res.locals.seo = buildSeo({
        title: "Order Tracking",
        description: "Track your Mizan Trade order status in real-time. Enter your order number and mobile number to get the latest updates on your shipment.",
        path: "/order-tracking"
    });

    return res.render("orderTracking", Object.assign({
        pageTitle: "Order Tracking",
        orderNumber: "",
        phone: "",
        error: "",
        order: null,
        steps: TRACKING_STEPS,
        stepIndex: -1
    }, data || {}));
}

exports.getOrderTracking = (req, res) => {
    return renderTracking(req, res);
};

exports.postOrderTracking = async (req, res) => {
    try {
        const orderNumber = String(req.body.orderNumber || "").trim().toUpperCase();
        const phone = String(req.body.phone || "").trim();

        if (!orderNumber || !phone) {
            return renderTracking(req, res, {
                orderNumber,
                phone,
                error: "Please enter both your order number and mobile number."
            });
        }

        const order = await Order.findOne({ orderNumber }).lean();

        // ফোন নম্বর মিললে অর্ডারের সাথে যুক্ত নম্বর (গেস্ট অর্ডার সুরক্ষা)
        if (!order || order.customer.phone.replace(/\D/g, "") !== phone.replace(/\D/g, "")) {
            return renderTracking(req, res, {
                orderNumber,
                phone,
                error: "No order found with this order number and mobile number combination. Please check both and try again."
            });
        }

        const stepIndex = order.status === "Cancelled"
            ? -1
            : TRACKING_STEPS.indexOf(order.status);

        return renderTracking(req, res, {
            orderNumber,
            phone,
            order,
            stepIndex
        });
    } catch (error) {
        console.error("Order tracking error:", error);
        return res.status(500).render("errors/500");
    }
};
