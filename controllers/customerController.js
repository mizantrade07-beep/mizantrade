const mongoose = require("mongoose");

const Customer = require("../models/Customer");
const Order = require("../models/Order");

const PAGE_SIZE = 20;

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

/* ======================================================
   ADMIN - CUSTOMER LIST
====================================================== */

exports.getCustomers = async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "").trim();
        const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);

        const filter = {};

        if (search) {
            const regex = new RegExp(escapeRegex(search), "i");
            filter.$or = [
                { name: regex },
                { email: regex },
                { phone: regex }
            ];
        }

        if (status === "active") {
            filter.isActive = true;
        } else if (status === "inactive") {
            filter.isActive = false;
        }

        const totalCustomers = await Customer.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(totalCustomers / PAGE_SIZE));
        const currentPage = Math.min(page, totalPages);
        const skip = (currentPage - 1) * PAGE_SIZE;

        const customers = await Customer.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .lean();

        const grandTotal = await Customer.countDocuments({});
        const activeTotal = await Customer.countDocuments({ isActive: true });

        return res.render("admin/customers", {
            pageTitle: "Customers",
            customers,
            search,
            status,
            currentPage,
            totalPages,
            totalCustomers: grandTotal,
            activeTotal
        });
    } catch (error) {
        console.error("Admin customer list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - CUSTOMER DETAIL
====================================================== */

exports.getCustomerDetail = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).render("errors/404", { pageTitle: "Not Found" });
        }

        const customer = await Customer.findById(req.params.id).lean();

        if (!customer) {
            return res.status(404).render("errors/404", { pageTitle: "Not Found" });
        }

        const orders = await Order.find({ customerId: customer._id })
            .sort({ createdAt: -1 })
            .lean();

        const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);

        return res.render("admin/customerDetail", {
            pageTitle: customer.name,
            customer,
            orders,
            totalSpent
        });
    } catch (error) {
        console.error("Admin customer detail error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - TOGGLE ACTIVE STATUS
====================================================== */

exports.toggleCustomerStatus = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).send("Invalid customer.");
        }

        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).send("Customer not found.");
        }

        customer.isActive = !customer.isActive;
        await customer.save();

        return res.redirect("/admin/customers/" + customer._id);
    } catch (error) {
        console.error("Toggle customer status error:", error);
        return res.status(500).send("Unable to update customer.");
    }
};

/* ======================================================
   ADMIN - DELETE CUSTOMER
====================================================== */

exports.deleteCustomer = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).send("Invalid customer.");
        }

        const customer = await Customer.findByIdAndDelete(req.params.id);

        if (!customer) {
            return res.status(404).send("Customer not found.");
        }

        return res.redirect("/admin/customers");
    } catch (error) {
        console.error("Delete customer error:", error);
        return res.status(500).send("Unable to delete customer.");
    }
};
