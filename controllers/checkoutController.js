const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const QRCode = require("qrcode");
const { validateCoupon } = require("./couponController");
const { sendSms, isConfigured: isSmsConfigured, normalizePhone } = require("../utils/sms");
const { orderOtpText } = require("../utils/smsTemplates");
const { notifyNewOrder } = require("../utils/notify");
const { effectiveFooter } = require("../utils/footerContent");
const {
    config: rewardConfig,
    maxRedeemable,
    pointsValue
} = require("../utils/rewards");
const siteConfig = require("../config/site");

/* ======================================================
   HELPERS
====================================================== */

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
    });
}

function jsonOk(res, message) {
    return res.json({ ok: true, message });
}

function jsonErr(res, status, error) {
    return res.status(status).json({ ok: false, error });
}

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

// Mobile banking "Send Money" carries a pass-on charge (percentage of the payable amount).
function calcPaymentCharge(percent, baseTotal) {
    return roundMoney(
        Math.max(0, baseTotal) * Number(percent || 0) / 100
    );
}

function roundMoney(n) {
    return Math.round(n * 100) / 100;
}

/* Admin can switch individual payment methods off in Settings. */
function gatewayEnabled(type) {
    const gateways = siteConfig.paymentGateways || {};

    if (type === "cod") {
        return !gateways.cod || gateways.cod.enabled !== false;
    }

    const gateway = gateways[type];
    return !gateway || gateway.enabled !== false;
}

/* Free-shipping threshold (subtotal based) overrides the zone charge. */
function calcShipping(zone, subtotal) {
    const courier = siteConfig.courier || {};
    const threshold = Number(courier.freeShippingThreshold) || 0;

    if (threshold > 0 && subtotal >= threshold) {
        return 0;
    }

    return Number(zone && zone.charge) || 0;
}

/* Tax/VAT row. "Inclusive" means prices already contain the tax, so the
   amount is shown for information but not added to the payable total. */
function calcTax(subtotalAfterDiscount, shipping) {
    const tax = siteConfig.tax || {};
    const enabled = tax.enabled === true;
    const percent = Number(tax.percent) || 0;
    const label = tax.label || "VAT";

    if (!enabled || percent <= 0) {
        return {
            enabled: false,
            label,
            percent: 0,
            amount: 0,
            added: 0,
            inclusive: false,
            applyToShipping: false
        };
    }

    const base = Math.max(
        0,
        Number(subtotalAfterDiscount) + (tax.applyToShipping ? shipping : 0)
    );
    const amount = roundMoney(base * percent / 100);
    const inclusive = tax.inclusive === true;

    return {
        enabled: true,
        label,
        percent,
        amount,
        added: inclusive ? 0 : amount,
        inclusive,
        applyToShipping: tax.applyToShipping === true
    };
}

const WALLET_META = {
    bkash: { label: "bKash", color: "#e2136e", app: "bKash app", dial: "*247#" },
    nagad: { label: "Nagad", color: "#f6921e", app: "Nagad app", dial: "*167#" },
    rocket: { label: "Rocket", color: "#8c3494", app: "Rocket app", dial: "*322#" }
};

function plainRow(row) {
    return row && row.toObject ? row.toObject() : { ...(row || {}) };
}

// Hidden duplicate inputs from unselected payment options can arrive as arrays.
function firstValue(value) {
    if (Array.isArray(value)) {
        return String(value.find(function (v) {
            return String(v || "").trim();
        }) || "").trim();
    }
    return String(value || "").trim();
}

function footerData(res) {
    return res.locals.footer || effectiveFooter(null);
}

function activeZones(footer) {
    const zones = (footer.shippingZones || []).map(plainRow);
    if (zones.length) return zones;

    return [
        {
            name: "Inside Dhaka",
            area: "Dhaka",
            thana: "",
            postalCodes: "",
            charge: Number(siteConfig.shipping.insideDhaka) || 0
        },
        {
            name: "Outside Dhaka",
            area: "Outside Dhaka",
            thana: "",
            postalCodes: "",
            charge: Number(siteConfig.shipping.outsideDhaka) || 0
        }
    ];
}

function resolveZone(footer, value) {
    const match = /^zone:(\d+)$/.exec(String(value || ""));
    if (!match) return null;

    return activeZones(footer)[Number(match[1])] || null;
}

async function buildPaymentOptions(footer) {
    const accounts = (footer.paymentAccounts || []).map(plainRow);
    const options = [];

    for (let i = 0; i < accounts.length; i++) {
        const a = accounts[i];

        if (!gatewayEnabled(a.type)) continue;

        const wallet = WALLET_META[a.type];
        const accountType = String(a.accountType || "").trim();
        const isMerchant = Boolean(wallet) && (
            /merchant/i.test(accountType) ||
            /merchant/i.test(String(a.label || ""))
        );
        let qr = a.qrImage || "";

        if (wallet && !qr && a.number) {
            try {
                qr = await QRCode.toDataURL(a.number, {
                    margin: 1,
                    width: 220,
                    color: { dark: wallet.color, light: "#ffffff" }
                });
            } catch (err) {
                console.error("Payment QR error:", err.message);
            }
        }

        options.push({
            value: "pay:" + i,
            type: a.type,
            wallet: !!wallet,
            label: a.label || (wallet ? wallet.label : a.bankName) || "Payment",
            walletLabel: wallet ? wallet.label : "",
            walletApp: wallet ? wallet.app : "",
            walletDial: wallet ? wallet.dial : "",
            number: a.number || "",
            accountType: a.accountType || "",
            isMerchant,
            chargePercent: Number(a.chargePercent) || 0,
            bankName: a.bankName || "",
            branch: a.branch || "",
            accountName: a.accountName || "",
            accountNumber: a.accountNumber || "",
            routingNumber: a.routingNumber || "",
            qr,
            instructions: a.instructions || ""
        });
    }

    return options;
}

function resolvePayment(footer, value) {
    if (value === "cod") {
        if (!gatewayEnabled("cod")) return null;
        return { method: "cod", account: null, chargePercent: 0 };
    }

    const match = /^pay:(\d+)$/.exec(String(value || ""));
    if (!match) return null;

    const rows = (footer.paymentAccounts || []).map(plainRow);
    const account = rows[Number(match[1])];
    if (!account) return null;

    const validTypes = ["bkash", "nagad", "rocket", "bank"];
    if (validTypes.indexOf(account.type) === -1) return null;
    if (!gatewayEnabled(account.type)) return null;

    return {
        method: account.type,
        account,
        chargePercent: Number(account.chargePercent) || 0
    };
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

    const footer = footerData(res);
    const zones = activeZones(footer);
    const paymentOptions = await buildPaymentOptions(footer);

    const initialZone = zones[0];
    const codEnabled = gatewayEnabled("cod");
    const initialPayment = paymentOptions.length
        ? paymentOptions[0]
        : {
            value: codEnabled ? "cod" : "",
            chargePercent: 0,
            walletLabel: "",
            type: "cod"
        };

    const initialShipping = calcShipping(initialZone, subtotal);
    const tax = calcTax(subtotal - discount, initialShipping);

    const baseTotal = Math.max(
        0,
        subtotal + initialShipping - discount + tax.added
    );
    const paymentCharge = calcPaymentCharge(
        initialPayment.chargePercent,
        baseTotal
    );

    const customer = req.session.customer || null;

    // Reward points available to redeem on this order.
    let rewardBalance = 0;

    if (customer && customer.id) {
        try {
            const rewardDoc = await Customer.findById(customer.id)
                .select("rewardPoints")
                .lean();
            rewardBalance = Number(rewardDoc && rewardDoc.rewardPoints) || 0;
        } catch (err) {
            console.error("Reward balance load error:", err.message);
        }
    }

    const rewardCfg = rewardConfig();
    const payableBeforeReward = Math.max(
        0,
        subtotal + initialShipping - discount
    );
    const maxRewardPoints = maxRedeemable(
        rewardBalance,
        payableBeforeReward
    );
    const reward = {
        enabled: rewardCfg.enabled,
        label: rewardCfg.label,
        balance: rewardBalance,
        minRedeem: rewardCfg.minRedeem,
        pointValue: rewardCfg.pointValue,
        maxPoints: maxRewardPoints,
        maxValue: pointsValue(maxRewardPoints)
    };
    const freeShippingThreshold =
        Number(siteConfig.courier && siteConfig.courier.freeShippingThreshold) || 0;

    // Every checkout session must verify the mobile number with a fresh OTP.
    const verifiedPhone = req.session.checkoutPhoneVerified || "";

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
        initialShipping,
        tax,
        reward,
        codEnabled,
        freeShippingThreshold,
        coupon,
        couponState,
        couponMessage,
        zones,
        initialZoneIndex: 0,
        paymentOptions,
        initialPaymentValue: initialPayment.value,
        initialChargePercent: initialPayment.chargePercent || 0,
        initialChargeLabel:
            initialPayment.walletLabel ||
            (initialPayment.type === "bank" ? "Bank Transfer" : "Payment"),
        customer,
        verifiedPhone
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
            village,
            thana,
            postOffice,
            district,
            note,
            shippingZone,
            paymentMethod,
            trxId,
            senderNumber,
            accountNumber
        } = req.body;

        if (!name || !phone || !shippingZone || !address || !village || !thana || !postOffice || !district || !paymentMethod) {
            return res.status(400).send(
                "Name, mobile, delivery area, village, thana, post office, district, and full address are required. <a href='/checkout'>Go Back</a>"
            );
        }

        const cleanPhone = normalizePhone(phone);

        if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
            return res.status(400).send(
                "Please enter a valid mobile number (01XXXXXXXXX). <a href='/checkout'>Go Back</a>"
            );
        }

        // The mobile number must be verified with an OTP code in this session.
        if (req.session.checkoutPhoneVerified !== cleanPhone) {
            return res.status(400).send(
                "Please verify your mobile number with the OTP code first. <a href='/checkout'>Go Back</a>"
            );
        }

        const footer = footerData(res);

        const zone = resolveZone(footer, shippingZone);

        if (!zone) {
            return res.status(400).send(
                "Please select a valid delivery area. <a href='/checkout'>Go Back</a>"
            );
        }

        const payment = resolvePayment(footer, paymentMethod);

        if (!payment) {
            return res.status(400).send(
                "Please select a valid payment method. <a href='/checkout'>Go Back</a>"
            );
        }

        if (
            ["bkash", "nagad", "rocket"].includes(payment.method) &&
            !firstValue(trxId)
        ) {
            return res.status(400).send(
                "The mobile banking Transaction ID (TrxID) is required. <a href='/checkout'>Go Back</a>"
            );
        }

        const subtotal = cartSubtotal(cart);

        const shippingFee = calcShipping(zone, subtotal);

        // Re-validate the session coupon before applying the discount.
        const coupon = await resolveSessionCoupon(
            req,
            cart,
            subtotal
        );

        const discount = coupon ? coupon.discount : 0;

        const payableBeforeReward = Math.max(
            0,
            subtotal + shippingFee - discount
        );

        const tax = calcTax(subtotal - discount, shippingFee);

        // Reward redemption — recomputed from the DB balance, never trusted
        // from the browser.
        const useRewards = ["on", "true", "1", "yes"].indexOf(
            firstValue(req.body.useRewards).toLowerCase()
        ) !== -1;

        let rewardPointsRedeemed = 0;
        let rewardDiscount = 0;
        let rewardBalance = 0;

        if (req.session.customer?.id) {
            const rewardDoc = await Customer.findById(
                req.session.customer.id
            )
                .select("rewardPoints")
                .lean();

            rewardBalance = Number(rewardDoc && rewardDoc.rewardPoints) || 0;

            if (useRewards) {
                rewardPointsRedeemed = maxRedeemable(
                    rewardBalance,
                    payableBeforeReward
                );
                rewardDiscount = pointsValue(rewardPointsRedeemed);
            }
        }

        const baseTotal = Math.max(
            0,
            payableBeforeReward - rewardDiscount + tax.added
        );

        const paymentCharge = calcPaymentCharge(
            payment.chargePercent,
            baseTotal
        );

        const total = roundMoney(baseTotal + paymentCharge);

        const account = payment.account || {};

        const paymentInfo = {
            trxId: firstValue(trxId).toUpperCase(),
            senderNumber: firstValue(senderNumber),
            accountLabel: account.label || "",
            accountType: account.accountType || "",
            receiverNumber: account.number || "",
            receiverBankName: account.bankName || "",
            receiverAccountName: account.accountName || "",
            receiverAccountNumber: account.accountNumber || "",
            receiverBranch: account.branch || "",
            receiverRoutingNumber: account.routingNumber || "",
            bankName: "",
            accountNumber: firstValue(accountNumber)
        };

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
                phone: cleanPhone,
                email: (email || "").trim(),
                address: address.trim(),
                village: (village || "").trim(),
                thana: (thana || "").trim(),
                postOffice: (postOffice || "").trim(),
                district: (district || "").trim(),
                city: zone.name || zone.area || "Delivery",
                note: (note || "").trim()
            },

            paymentMethod: payment.method,

            paymentInfo,

            subtotal,
            shippingFee,
            couponCode: coupon ? coupon.code : "",
            discount,
            rewardPointsRedeemed,
            rewardDiscount,
            taxLabel: tax.enabled ? tax.label : "",
            taxAmount: tax.amount,
            taxIncluded: tax.inclusive,
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

        // Award / redeem reward points for this order.
        if (req.session.customer?.id) {
            const productIds = cart.items.map(
                (item) => item.productId
            );

            const rewardDocs = await Product.find({
                _id: { $in: productIds }
            })
                .select("rewardPoints")
                .lean();

            const pointMap = {};

            rewardDocs.forEach((doc) => {
                pointMap[String(doc._id)] =
                    Number(doc.rewardPoints) || 0;
            });

            const earned = cart.items.reduce(
                (sum, item) =>
                    sum +
                    (pointMap[String(item.productId)] || 0) *
                        item.quantity,
                0
            );

            const history = [];

            if (rewardPointsRedeemed > 0) {
                history.push({
                    type: "redeem",
                    points: rewardPointsRedeemed,
                    orderNumber: order.orderNumber
                });
            }

            if (earned > 0) {
                history.push({
                    type: "earn",
                    points: earned,
                    orderNumber: order.orderNumber
                });
            }

            if (history.length) {
                const update = {
                    $inc: {
                        rewardPoints: earned - rewardPointsRedeemed
                    },
                    $push: { pointsHistory: { $each: history } }
                };

                // Never let a stale balance drive points below zero.
                if (rewardPointsRedeemed > 0) {
                    await Customer.updateOne(
                        {
                            _id: req.session.customer.id,
                            rewardPoints: { $gte: rewardPointsRedeemed }
                        },
                        update
                    );
                } else {
                    await Customer.updateOne(
                        { _id: req.session.customer.id },
                        update
                    );
                }
            }

            if (earned > 0) {
                order.rewardPointsEarned = earned;
                await order.save();
            }
        }

        // Order notifications: admin e-mails + SMS, customer e-mail + SMS.
        try {
            await notifyNewOrder(order, (email || "").trim());
        } catch (notifyError) {
            console.error("Order notification error:", notifyError);
        }

        req.session.cart = {
            items: []
        };

        req.session.coupon = null;

        // The OTP verification is single-use per order.
        req.session.checkoutPhoneVerified = null;
        req.session.checkoutOtp = null;

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
   CHECKOUT MOBILE OTP VERIFICATION (SMS)
====================================================== */

exports.sendCheckoutOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);

        if (!/^01[3-9]\d{8}$/.test(phone)) {
            return jsonErr(res, 400, "Please enter a valid mobile number (01XXXXXXXXX).");
        }

        if (!isSmsConfigured()) {
            return jsonErr(res, 503, "SMS verification is not available right now.");
        }

        const previous = req.session.checkoutOtp;
        if (
            previous &&
            previous.phone === phone &&
            previous.sentAt &&
            Date.now() - previous.sentAt < 60 * 1000
        ) {
            const wait = Math.ceil(
                (60 * 1000 - (Date.now() - previous.sentAt)) / 1000
            );
            return jsonErr(res, 429, "Please wait " + wait + "s before requesting another code.");
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const text = orderOtpText(code);

        req.session.checkoutOtp = {
            phone,
            code,
            sentAt: Date.now(),
            expires: Date.now() + 5 * 60 * 1000,
            attempts: 0
        };
        await saveSession(req);

        const result = await sendSms(phone, text);

        if (!result.ok) {
            console.error(
                "Checkout OTP SMS failed: code=" + (result.code || "-") + " " +
                (result.error || result.body)
            );
            req.session.checkoutOtp = null;
            await saveSession(req);
            return jsonErr(res, 502, "Could not send the verification code. Please try again later.");
        }

        return jsonOk(res, "We sent a 6-digit code by SMS to " + phone + ".");
    } catch (error) {
        console.error("sendCheckoutOtp error:", error);
        return jsonErr(res, 500, "Something went wrong. Please try again.");
    }
};

exports.verifyCheckoutOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        const code = String(req.body.code || "").trim();
        const otp = req.session.checkoutOtp;

        if (!otp || otp.phone !== phone) {
            return jsonErr(res, 400, "Please request a new code.");
        }

        if (Date.now() > otp.expires) {
            req.session.checkoutOtp = null;
            await saveSession(req);
            return jsonErr(res, 400, "The code has expired. Please request a new one.");
        }

        if (otp.code !== code) {
            otp.attempts = (otp.attempts || 0) + 1;
            const exhausted = otp.attempts >= 4;
            if (exhausted) req.session.checkoutOtp = null;
            await saveSession(req);

            return jsonErr(
                res,
                400,
                exhausted
                    ? "Too many wrong attempts. Please request a new code."
                    : "Incorrect code. Please try again."
            );
        }

        req.session.checkoutPhoneVerified = otp.phone;
        req.session.checkoutOtp = null;
        await saveSession(req);

        return jsonOk(res, "Mobile number verified.");
    } catch (error) {
        console.error("verifyCheckoutOtp error:", error);
        return jsonErr(res, 500, "Something went wrong. Please try again.");
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