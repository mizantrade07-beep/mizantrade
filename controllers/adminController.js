const Product = require("../models/Product");
const PartnerRequest = require("../models/PartnerRequest");
const Admin = require("../models/Admin");
const Order = require("../models/Order");

exports.getDashboard = async (req, res, next) => {
    try {
        const [
            totalProducts,
            totalPartners,
            pendingPartners,
            totalAdmins,
            totalOrders,
            pendingOrders,
            recentPartners,
            recentOrders
        ] = await Promise.all([
            Product.countDocuments(),
            PartnerRequest.countDocuments(),
            PartnerRequest.countDocuments({ status: "Pending" }),
            Admin.countDocuments(),
            Order.countDocuments(),
            Order.countDocuments({ status: "Pending" }),
            PartnerRequest
                .find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            Order
                .find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
        ]);

        const totalReviews = await Product.aggregate([
            {
                $project: {
                    reviewCount: {
                        $size: {
                            $ifNull: ["$reviews", []]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: "$reviewCount"
                    }
                }
            }
        ]);

        const reviewCount =
            totalReviews.length > 0
                ? totalReviews[0].total
                : 0;

        res.render("admin/dashboard/index", {
            pageTitle: "Dashboard",
            stats: {
                totalProducts,
                totalPartners,
                pendingPartners,
                totalAdmins,
                totalOrders,
                pendingOrders,
                totalReviews: reviewCount
            },
            recentPartners,
            recentOrders
        });
    } catch (error) {
        next(error);
    }
};

exports.getPartnerRequests = async (req, res, next) => {
    try {
        const requests = await PartnerRequest
            .find({})
            .sort({ createdAt: -1 })
            .lean();

        res.render("admin/partners", {
            pageTitle: "Partner Applications",
            requests
        });
    } catch (error) {
        next(error);
    }
};