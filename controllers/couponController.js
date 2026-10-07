const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");
const Product = require("../models/Product");
const Customer = require("../models/Customer");

const PAGE_SIZE = 20;

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseIdList(value) {
    const arr = [].concat(value || []);

    return arr
        .map((v) => String(v).trim())
        .filter((v) => v && mongoose.Types.ObjectId.isValid(v));
}

function parseDate(value) {
    if (!value) return null;

    const d = new Date(value);

    return isNaN(d.getTime()) ? null : d;
}

function toNumber(value) {
    const n = Number(value);

    return Number.isFinite(n) && n >= 0 ? n : 0;
}

/* ======================================================
   ADMIN - LIST
====================================================== */

exports.getAdminCoupons = async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "").trim();
        const page = Math.max(1, Number(req.query.page) || 1);

        const filter = {};

        if (status === "active") filter.isActive = true;
        if (status === "inactive") filter.isActive = false;

        if (search) {
            filter.code = {
                $regex: escapeRegex(search),
                $options: "i"
            };
        }

        const [coupons, totalCoupons, activeTotal] = await Promise.all([
            Coupon.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .lean(),

            Coupon.countDocuments(filter),

            Coupon.countDocuments({
                isActive: true
            })
        ]);

        return res.render("admin/coupons", {
            pageTitle: "Coupons",
            coupons,
            search,
            status,
            totalCoupons,
            activeTotal,
            currentPage: page,
            totalPages: Math.ceil(totalCoupons / PAGE_SIZE)
        });
    } catch (error) {
        console.error("Admin coupon list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - ADD / EDIT FORM DATA
====================================================== */

async function getFormOptions() {
    const [products, customers] = await Promise.all([
        Product.find({ isActive: true })
            .sort({ title: 1 })
            .select("title sku")
            .lean(),

        Customer.find({})
            .sort({ name: 1 })
            .select("name email phone")
            .lean()
    ]);

    return {
        products,
        customers
    };
}

exports.getAddCouponPage = async (req, res) => {
    try {
        const { products, customers } = await getFormOptions();

        return res.render("admin/couponForm", {
            pageTitle: "Add Coupon",
            coupon: null,
            products,
            customers
        });
    } catch (error) {
        console.error("Add coupon page error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.getEditCouponPage = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).render("errors/404", {
                pageTitle: "Not Found"
            });
        }

        const coupon = await Coupon.findById(req.params.id).lean();

        if (!coupon) {
            return res.status(404).render("errors/404", {
                pageTitle: "Not Found"
            });
        }

        const { products, customers } = await getFormOptions();

        return res.render("admin/couponForm", {
            pageTitle: "Edit Coupon",
            coupon,
            products,
            customers
        });
    } catch (error) {
        console.error("Edit coupon page error:", error);
        return res.status(500).render("errors/500");
    }
};

function buildCouponData(body) {
    return {
        code: String(body.code || "").trim().toUpperCase(),
        description: String(body.description || "").trim(),
        discountType: body.discountType === "fixed" ? "fixed" : "percent",
        discountValue: toNumber(body.discountValue),
        maxDiscount: toNumber(body.maxDiscount),
        minOrderAmount: toNumber(body.minOrderAmount),
        applicableProducts: parseIdList(body.applicableProducts),
        applicableCustomers: parseIdList(body.applicableCustomers),
        usageLimit: toNumber(body.usageLimit),
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        isActive: body.isActive === "on" || body.isActive === "true"
    };
}

exports.postAddCoupon = async (req, res) => {
    try {
        const data = buildCouponData(req.body);

        if (!data.code) {
            return res.status(400).send(
                "Coupon code is required. <a href='/admin/coupons/add'>Go Back</a>"
            );
        }

        if (data.discountValue <= 0) {
            return res.status(400).send(
                "Discount value must be greater than zero. <a href='/admin/coupons/add'>Go Back</a>"
            );
        }

        await Coupon.create(data);

        return res.redirect("/admin/coupons");
    } catch (error) {
        console.error("Add coupon error:", error);

        if (error.code === 11000) {
            return res.status(400).send(
                "This coupon code already exists. <a href='/admin/coupons/add'>Go Back</a>"
            );
        }

        return res.status(500).send("Unable to create coupon.");
    }
};

exports.postEditCoupon = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send("Coupon not found.");
        }

        const data = buildCouponData(req.body);

        if (!data.code) {
            return res.status(400).send("Coupon code is required.");
        }

        await Coupon.findByIdAndUpdate(req.params.id, data, {
            new: true,
            runValidators: true
        });

        return res.redirect("/admin/coupons");
    } catch (error) {
        console.error("Edit coupon error:", error);

        if (error.code === 11000) {
            return res.status(400).send(
                "This coupon code already exists."
            );
        }

        return res.status(500).send("Unable to update coupon.");
    }
};

exports.toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).send("Coupon not found.");
        }

        coupon.isActive = !coupon.isActive;

        await coupon.save();

        return res.redirect(
            req.headers.referer || "/admin/coupons"
        );
    } catch (error) {
        console.error("Toggle coupon error:", error);
        return res.status(500).send(
            "Unable to change coupon status."
        );
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);

        return res.redirect("/admin/coupons");
    } catch (error) {
        console.error("Delete coupon error:", error);
        return res.status(500).send("Unable to delete coupon.");
    }
};

/* ======================================================
   VALIDATION HELPER (Used during checkout)
   items: [{ productId, price, quantity }]
====================================================== */

async function validateCoupon(
    code,
    {
        customerId = null,
        items = [],
        subtotal = 0
    } = {}
) {
    const cleanCode = String(code || "").trim().toUpperCase();

    if (!cleanCode) {
        return {
            valid: false,
            message: "Please enter a coupon code."
        };
    }

    const coupon = await Coupon.findOne({
        code: cleanCode
    }).lean();

    if (!coupon) {
        return {
            valid: false,
            message: "This coupon code is not valid."
        };
    }

    if (!coupon.isActive) {
        return {
            valid: false,
            message: "This coupon is currently inactive."
        };
    }

    const now = new Date();

    if (coupon.startDate && now < new Date(coupon.startDate)) {
        return {
            valid: false,
            message: "This coupon has not started yet."
        };
    }

    if (coupon.endDate && now > new Date(coupon.endDate)) {
        return {
            valid: false,
            message: "This coupon has expired."
        };
    }

    if (
        coupon.usageLimit > 0 &&
        coupon.usedCount >= coupon.usageLimit
    ) {
        return {
            valid: false,
            message: "This coupon has reached its usage limit."
        };
    }

    // Customer-specific coupon
    if (
        coupon.applicableCustomers &&
        coupon.applicableCustomers.length > 0
    ) {
        const allowed = coupon.applicableCustomers.map(String);

        if (
            !customerId ||
            allowed.indexOf(String(customerId)) === -1
        ) {
            return {
                valid: false,
                message: "This coupon is not applicable to your account."
            };
        }
    }

    // Product-specific coupon: discount applies only to matching items
    let base = subtotal;

    if (
        coupon.applicableProducts &&
        coupon.applicableProducts.length > 0
    ) {
        const allowed = coupon.applicableProducts.map(String);

        base = items.reduce((sum, it) => {
            return allowed.indexOf(String(it.productId)) !== -1
                ? sum + it.price * it.quantity
                : sum;
        }, 0);

        if (base <= 0) {
            return {
                valid: false,
                message: "There are no applicable products for this coupon in your cart."
            };
        }
    }

    if (
        coupon.minOrderAmount > 0 &&
        subtotal < coupon.minOrderAmount
    ) {
        return {
            valid: false,
            message:
                "This coupon is valid only for orders of at least ৳" +
                coupon.minOrderAmount.toLocaleString("en-US") +
                "."
        };
    }

    let discount = 0;

    if (coupon.discountType === "percent") {
        discount =
            (base * coupon.discountValue) / 100;

        if (
            coupon.maxDiscount > 0 &&
            discount > coupon.maxDiscount
        ) {
            discount = coupon.maxDiscount;
        }
    } else {
        discount = Math.min(
            coupon.discountValue,
            base
        );
    }

    discount = Math.max(
        0,
        Math.round(discount)
    );

    discount = Math.min(
        discount,
        Math.round(base)
    );

    if (discount <= 0) {
        return {
            valid: false,
            message: "No discount was available with this coupon."
        };
    }

    return {
        valid: true,
        discount,
        couponId: String(coupon._id),
        code: coupon.code,
        message:
            "Coupon applied — ৳" +
            discount.toLocaleString("en-US") +
            " discount."
    };
}

exports.validateCoupon = validateCoupon;

/* ======================================================
   PUBLIC - APPLY / REMOVE COUPON (Session-based)
====================================================== */

exports.applyCoupon = async (req, res) => {
    try {
        const cart =
            req.session.cart &&
            req.session.cart.items
                ? req.session.cart.items
                : [];

        if (cart.length === 0) {
            req.session.coupon = null;

            return res.redirect(
                "/checkout?coupon=empty"
            );
        }

        const subtotal = cart.reduce(
            (s, it) => s + it.price * it.quantity,
            0
        );

        const customerId =
            req.session.customer
                ? req.session.customer.id
                : null;

        const result = await validateCoupon(
            req.body.code,
            {
                customerId,
                items: cart,
                subtotal
            }
        );

        if (!result.valid) {
            req.session.coupon = null;

            return res.redirect(
                "/checkout?coupon=error&msg=" +
                encodeURIComponent(result.message)
            );
        }

        req.session.coupon = {
            code: result.code,
            couponId: result.couponId,
            discount: result.discount
        };

        return res.redirect(
            "/checkout?coupon=applied"
        );
    } catch (error) {
        console.error("Apply coupon error:", error);

        return res.redirect(
            "/checkout?coupon=error&msg=" +
            encodeURIComponent("Unable to apply coupon.")
        );
    }
};

exports.removeCoupon = (req, res) => {
    req.session.coupon = null;

    return res.redirect("/checkout");
};