const Order = require("../models/Order");
const Customer = require("../models/Customer");
const { getSettingsDoc, saveSettings } = require("../utils/siteSettings");

function str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function num(value, def, min, max) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = def;
    if (typeof min === "number" && n < min) n = min;
    if (typeof max === "number" && n > max) n = max;
    return n;
}

function bool(value) {
    return value === true || value === "on" || value === "true" || value === "1";
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
}

function roundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function monthKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

/* ======================================================
   ADMIN - REWARD POINTS (GET)
====================================================== */

exports.getRewards = async (req, res) => {
    try {
        const settings = await getSettingsDoc();
        const rewards = settings.rewards || {};
        const pointValue = rewards.pointValue === undefined
            ? 1
            : Number(rewards.pointValue) || 0;

        const today = new Date();
        const defaultFrom = new Date(today);
        defaultFrom.setDate(defaultFrom.getDate() - 29);

        const from = startOfDay(parseDate(req.query.from) || defaultFrom);
        const to = endOfDay(parseDate(req.query.to) || today);

        if (from > to) {
            return res.redirect("/admin/rewards?message=range");
        }

        const rangeMatch = { createdAt: { $gte: from, $lte: to } };

        const [usageAgg, topRedeemersAgg, monthlyAgg, balanceAgg, bestCustomers, uniqueIds] =
            await Promise.all([
                Order.aggregate([
                    { $match: rangeMatch },
                    {
                        $group: {
                            _id: null,
                            redeemed: { $sum: "$rewardPointsRedeemed" },
                            earned: { $sum: "$rewardPointsEarned" },
                            redeemOrders: {
                                $sum: {
                                    $cond: [{ $gt: ["$rewardPointsRedeemed", 0] }, 1, 0]
                                }
                            }
                        }
                    }
                ]),
                Order.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: from, $lte: to },
                            rewardPointsRedeemed: { $gt: 0 },
                            customerId: { $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: "$customerId",
                            points: { $sum: "$rewardPointsRedeemed" },
                            orders: { $sum: 1 }
                        }
                    },
                    { $sort: { points: -1 } },
                    { $limit: 8 }
                ]),
                Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: new Date(today.getFullYear(), today.getMonth() - 5, 1)
                            }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                y: { $year: "$createdAt" },
                                m: { $month: "$createdAt" }
                            },
                            earned: { $sum: "$rewardPointsEarned" },
                            redeemed: { $sum: "$rewardPointsRedeemed" }
                        }
                    }
                ]),
                Customer.aggregate([
                    { $match: { rewardPoints: { $gt: 0 } } },
                    {
                        $group: {
                            _id: null,
                            points: { $sum: "$rewardPoints" },
                            members: { $sum: 1 }
                        }
                    }
                ]),
                Customer.find({ rewardPoints: { $gt: 0 } })
                    .sort({ rewardPoints: -1 })
                    .limit(8)
                    .select("name email phone rewardPoints")
                    .lean(),
                Order.distinct("customerId", {
                    ...rangeMatch,
                    rewardPointsRedeemed: { $gt: 0 },
                    customerId: { $ne: null }
                })
            ]);

        const usage = usageAgg[0] || {
            redeemed: 0,
            earned: 0,
            redeemOrders: 0,
            customers: []
        };

        const orders = await Order.find({
            ...rangeMatch,
            rewardPointsRedeemed: { $gt: 0 }
        })
            .sort({ createdAt: -1 })
            .limit(200)
            .select("orderNumber customerId customer.name customer.phone rewardPointsRedeemed rewardDiscount total createdAt")
            .lean();

        const customerIds = [
            ...new Set(
                orders
                    .map((o) => (o.customerId ? String(o.customerId) : ""))
                    .filter(Boolean)
            )
        ];

        const customerDocs = await Customer.find({ _id: { $in: customerIds } })
            .select("name email phone")
            .lean();

        const customerMap = {};
        customerDocs.forEach((c) => {
            customerMap[String(c._id)] = c;
        });

        const rows = orders.map((o) => {
            const customer = o.customerId
                ? customerMap[String(o.customerId)]
                : null;

            return {
                orderNumber: o.orderNumber,
                orderId: o._id,
                date: o.createdAt,
                customerName:
                    (customer && customer.name) ||
                    (o.customer && o.customer.name) ||
                    "Guest",
                customerPhone:
                    (customer && customer.phone) ||
                    (o.customer && o.customer.phone) ||
                    "",
                points: Number(o.rewardPointsRedeemed) || 0,
                value: Number(o.rewardDiscount) || 0,
                orderTotal: Number(o.total) || 0
            };
        });

        const topIds = topRedeemersAgg.map((t) => t._id).filter(Boolean);
        const topDocs = await Customer.find({ _id: { $in: topIds } })
            .select("name email phone")
            .lean();
        const topMap = {};
        topDocs.forEach((c) => {
            topMap[String(c._id)] = c;
        });

        const topRedeemers = topRedeemersAgg.map((t) => {
            const c = topMap[String(t._id)] || {};
            return {
                name: c.name || "Deleted customer",
                email: c.email || "",
                phone: c.phone || "",
                points: t.points,
                orders: t.orders,
                value: roundMoney(t.points * pointValue)
            };
        });

        // Build a 6-month series (oldest → newest), filling empty months.
        const monthlyMap = {};
        monthlyAgg.forEach((m) => {
            monthlyMap[m._id.y + "-" + String(m._id.m).padStart(2, "0")] = m;
        });

        const monthly = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = monthKey(d);
            const row = monthlyMap[key] || { earned: 0, redeemed: 0 };
            monthly.push({
                label: d.toLocaleDateString("en-US", { month: "short" }),
                earned: row.earned || 0,
                redeemed: row.redeemed || 0
            });
        }

        const maxMonthly = Math.max(
            1,
            ...monthly.map((m) => Math.max(m.earned, m.redeemed))
        );

        const liability = balanceAgg[0] || { points: 0, members: 0 };
        const uniqueCustomers = (uniqueIds || []).length;

        const stats = {
            earned: Number(usage.earned) || 0,
            redeemed: Number(usage.redeemed) || 0,
            redeemOrders: Number(usage.redeemOrders) || 0,
            uniqueCustomers,
            redeemedValue: roundMoney((usage.redeemed || 0) * pointValue),
            outstandingPoints: Number(liability.points) || 0,
            outstandingValue: roundMoney((liability.points || 0) * pointValue),
            members: Number(liability.members) || 0,
            rate: usage.earned > 0
                ? Math.round((usage.redeemed / usage.earned) * 1000) / 10
                : 0
        };

        return res.render("admin/rewards", {
            pageTitle: "Reward Points",
            settings,
            pointValue,
            stats,
            rows,
            topRedeemers,
            bestCustomers,
            monthly,
            maxMonthly,
            range: {
                from: from.toISOString().slice(0, 10),
                to: to.toISOString().slice(0, 10)
            },
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getRewards error:", error.message);
        return res.redirect("/admin/dashboard");
    }
};

/* ======================================================
   ADMIN - SAVE REWARD SETTINGS (POST)
====================================================== */

exports.postRewards = async (req, res) => {
    try {
        const body = req.body || {};

        await saveSettings({
            rewards: {
                enabled: bool(body.enabled),
                pointValue: num(body.pointValue, 1, 0, 100000),
                minRedeem: Math.round(num(body.minRedeem, 50, 0, 1000000)),
                label: str(body.label) || "Reward Points"
            }
        });

        return res.redirect("/admin/rewards?message=saved");
    } catch (error) {
        console.error("postRewards error:", error.message);
        return res.redirect("/admin/rewards?message=error");
    }
};
