const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Product = require("../models/Product");

const RANGES = {
    "7": 7,
    "30": 30,
    "90": 90,
    all: null
};

function rangeStart(range) {
    const days = RANGES[range];
    if (!days) return null;

    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));

    return d;
}

exports.getAnalytics = async (req, res) => {
    try {
        const range =
            RANGES[req.query.range] !== undefined
                ? req.query.range
                : "30";

        const start = rangeStart(range);

        const dateMatch = start
            ? { createdAt: { $gte: start } }
            : {};

        // Revenue is calculated excluding cancelled orders
        const revenueMatch = Object.assign({}, dateMatch, {
            status: { $ne: "Cancelled" }
        });

        const [
            orderStats,
            statusRows,
            paymentRows,
            trendRows,
            topProductRows,
            totalCustomers,
            activeCustomers,
            newCustomers,
            recentLogins,
            totalProducts
        ] = await Promise.all([
            Order.aggregate([
                { $match: revenueMatch },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: "$total" },
                        discount: { $sum: "$discount" },
                        shipping: { $sum: "$shippingFee" },
                        orders: { $sum: 1 }
                    }
                }
            ]),

            Order.aggregate([
                { $match: dateMatch },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            Order.aggregate([
                { $match: revenueMatch },
                {
                    $group: {
                        _id: "$paymentMethod",
                        count: { $sum: 1 },
                        revenue: { $sum: "$total" }
                    }
                },
                { $sort: { revenue: -1 } }
            ]),

            Order.aggregate([
                { $match: revenueMatch },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$createdAt"
                            }
                        },
                        revenue: { $sum: "$total" },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            Order.aggregate([
                { $match: revenueMatch },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.title",
                        qty: { $sum: "$items.quantity" },
                        revenue: {
                            $sum: {
                                $multiply: [
                                    "$items.price",
                                    "$items.quantity"
                                ]
                            }
                        }
                    }
                },
                { $sort: { qty: -1 } },
                { $limit: 8 }
            ]),

            Customer.countDocuments({}),

            Customer.countDocuments({
                isActive: true
            }),

            Customer.countDocuments(
                start
                    ? { createdAt: { $gte: start } }
                    : {}
            ),

            Customer.find({
                lastLoginAt: { $ne: null }
            })
                .sort({ lastLoginAt: -1 })
                .limit(10)
                .select("name email lastLoginAt")
                .lean(),

            Product.countDocuments({})
        ]);

        const stat = orderStats[0] || {
            revenue: 0,
            discount: 0,
            shipping: 0,
            orders: 0
        };

        const avgOrderValue =
            stat.orders > 0
                ? Math.round(stat.revenue / stat.orders)
                : 0;

        const paymentLabels = {
            bkash: "bKash",
            cod: "Cash on Delivery",
            bank: "Bank Transfer"
        };

        const byPayment = paymentRows.map(function (r) {
            return {
                method: paymentLabels[r._id] || r._id || "—",
                count: r.count,
                revenue: r.revenue
            };
        });

        const byStatus = statusRows.map(function (r) {
            return {
                status: r._id,
                count: r.count
            };
        });

        const trend = trendRows.map(function (r) {
            return {
                date: r._id,
                revenue: r.revenue,
                orders: r.orders
            };
        });

        const topProducts = topProductRows.map(function (r) {
            return {
                title: r._id,
                qty: r.qty,
                revenue: r.revenue
            };
        });

        return res.render("admin/analytics", {
            pageTitle: "Analytics",
            range,

            stats: {
                revenue: stat.revenue,
                discount: stat.discount,
                shipping: stat.shipping,
                orders: stat.orders,
                avgOrderValue,
                totalCustomers,
                activeCustomers,
                newCustomers,
                totalProducts
            },

            byStatus,
            byPayment,
            trend,
            topProducts,
            recentLogins,

            trendJson: JSON.stringify(trend),

            paymentJson: JSON.stringify(
                byPayment.map(function (p) {
                    return {
                        label: p.method,
                        value: p.revenue
                    };
                })
            ),

            statusJson: JSON.stringify(
                byStatus.map(function (s) {
                    return {
                        label: s.status,
                        value: s.count
                    };
                })
            )
        });
    } catch (error) {
        console.error("Analytics error:", error);
        return res.status(500).render("errors/500");
    }
};