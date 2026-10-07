const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const { validateCoupon } = require("./couponController");
const siteConfig = require("../config/site");

/* ======================================================
   HELPERS
====================================================== */

function getCart(req) {
    if (!req.session.cart) {
        req.session.cart = { items: [] };
    }

    return req.session.cart;
}

function cartSubtotal(cart) {
    return cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
}

// bKash "Send Money" carries a pass-on charge (percentage of the payable amount).
function calcPaymentCharge(paymentMethod, baseTotal) {
    if (paymentMethod !== "bkash") return 0;
    const percent = Number(siteConfig.bkash.chargePercent || 0);
    return roundMoney(Math.max(0, baseTotal) * percent / 100);
}

function roundMoney(n) {
    return Math.round(n * 100) / 100;
}

// Validate whether the coupon stored in the session is still valid for the current cart.
// Returns { code, discount } if valid, otherwise null. Also clears the session coupon if invalid.
async function resolveSessionCoupon(req, cart, subtotal) {
    const stored = req.session.coupon;

    if (!stored || !stored.code) {
        return null;
    }

    const customerId = req.session.customer
        ? req.session.customer.id
        : null;

    const result = await validateCoupon(stored.code, {
        customerId,
        items: cart.items,
        subtotal
    });

    if (!result.valid) {
        req.session.coupon = null;
        return null;
    }

    // The discount may change when the cart changes, so store the latest value.
    req.session.coupon = {
        code: result.code,
        couponId: result.couponId,
        discount: result.discount
    };

    return {
        code: result.code,
        discount: result.discount
    };
}

function generateOrderNumber() {
    const now = new Date();

    const datePart =
        now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");

    const randomPart = Math.floor(
        1000 + Math.random() * 9000
    );

    return "MT-" + datePart + "-" + randomPart;
}

/* ======================================================
   CHECKOUT PAGE
====================================================== */

exports.getCheckout = async (req, res) => {
    const cart = getCart(req);

    if (cart.items.length === 0) {
        return res.redirect("/cart");
    }

    const subtotal = cartSubtotal(cart);

    const coupon = await resolveSessionCoupon(
        req,
        cart,
        subtotal
    );

    const discount = coupon ? coupon.discount : 0;

    // bKash is selected by default on the checkout form.
    const baseTotal = Math.max(
        0,
        subtotal + siteConfig.shipping.insideDhaka - discount
    );
    const paymentCharge = calcPaymentCharge("bkash", baseTotal);

    const customer = req.session.customer || null;

    const couponState = req.query.coupon || "";
    const couponMessage = req.query.msg
        ? String(req.query.msg)
        : "";

    return res.render("checkout", {
        pageTitle: "Checkout",
        items: cart.items,
        subtotal,
        discount,
        paymentCharge,
        bkashChargePercent: siteConfig.bkash.chargePercent,
        coupon,
        couponState,
        couponMessage,
        shipping: siteConfig.shipping,
        bkash: siteConfig.bkash,
        bank: siteConfig.bank,
        customer
    });
};

/* ======================================================
   PLACE ORDER
====================================================== */

exports.postCheckout = async (req, res) => {
    try {
        const cart = getCart(req);

        if (cart.items.length === 0) {
            return res.redirect("/cart");
        }

        const {
            name,
            phone,
            email,
            address,
            city,
            note,
            paymentMethod,
            trxId,
            senderNumber,
            bankName,
            accountNumber
        } = req.body;

        if (!name || !phone || !address || !city || !paymentMethod) {
            return res.status(400).send(
                "Name, phone, address, and payment method are required. <a href='/checkout'>Go Back</a>"
            );
        }

        if (!["bkash", "cod", "bank"].includes(paymentMethod)) {
            return res.status(400).send(
                "Please select a valid payment method."
            );
        }

        if (paymentMethod === "bkash" && !trxId) {
            return res.status(400).send(
                "The bKash Transaction ID (TrxID) is required. <a href='/checkout'>Go Back</a>"
            );
        }

        const subtotal = cartSubtotal(cart);

        const shippingFee =
            city === "dhaka"
                ? siteConfig.shipping.insideDhaka
                : siteConfig.shipping.outsideDhaka;

        // Re-validate the session coupon before applying the discount.
        const coupon = await resolveSessionCoupon(
            req,
            cart,
            subtotal
        );

        const discount = coupon ? coupon.discount : 0;

        const baseTotal = Math.max(
            0,
            subtotal + shippingFee - discount
        );

        const paymentCharge = calcPaymentCharge(paymentMethod, baseTotal);

        const total = roundMoney(baseTotal + paymentCharge);

        const order = await Order.create({
            orderNumber: generateOrderNumber(),

            customerId: req.session.customer?.id || null,

            items: cart.items.map((item) => ({
                product: item.productId,
                title: item.title,
                slug: item.slug,
                image: item.image,
                price: item.price,
                quantity: item.quantity
            })),

            customer: {
                name: name.trim(),
                phone: phone.trim(),
                email: (email || "").trim(),
                address: address.trim(),
                city:
                    city === "dhaka"
                        ? "Inside Dhaka"
                        : "Outside Dhaka",
                note: (note || "").trim()
            },

            paymentMethod,

            paymentInfo: {
                trxId: (trxId || "").trim().toUpperCase(),
                senderNumber: (senderNumber || "").trim(),
                bankName: (bankName || "").trim(),
                accountNumber: (accountNumber || "").trim()
            },

            subtotal,
            shippingFee,
            couponCode: coupon ? coupon.code : "",
            discount,
            paymentCharge,
            total
        });

        // Increase the coupon usage count.
        if (
            coupon &&
            req.session.coupon &&
            req.session.coupon.couponId
        ) {
            await Coupon.findByIdAndUpdate(
                req.session.coupon.couponId,
                {
                    $inc: {
                        usedCount: 1
                    }
                }
            );
        }

        req.session.cart = {
            items: []
        };

        req.session.coupon = null;

        return res.redirect(
            "/order/success/" + order.orderNumber
        );
    } catch (error) {
        console.error("Checkout error:", error);

        return res
            .status(500)
            .send(
                "Unable to complete the order. Please try again."
            );
    }
};

/* ======================================================
   ORDER SUCCESS PAGE
====================================================== */

exports.getOrderSuccess = async (req, res) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber
        }).lean();

        if (!order) {
            return res.status(404).render("errors/404");
        }

        return res.render("orderSuccess", {
            pageTitle: "Order Confirmed",
            order,
            bkash: siteConfig.bkash,
            bank: siteConfig.bank
        });
    } catch (error) {
        console.error("Order success page error:", error);
        return res.status(500).send("Server Error");
    }
};