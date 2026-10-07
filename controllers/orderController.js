const Order = require("../models/Order");

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

        await Order.findByIdAndUpdate(req.params.id, { status });

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
