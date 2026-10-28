/* ======================================================
   Order notifications — admin + customer e-mail & SMS
   with invoice summary and order number. Never throws:
   a failed notification must not break a placed order.
====================================================== */

const { sendMail } = require("./mailer");
const { sendSms, normalizePhone } = require("./sms");
const { orderConfirmedText } = require("./smsTemplates");
const siteConfig = require("../config/site");

function adminEmails() {
    const envList = String(process.env.ADMIN_NOTIFY_EMAILS || "").trim();
    if (envList) {
        return envList.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return siteConfig.notifications.adminEmails;
}

function adminPhones() {
    const envList = String(process.env.ADMIN_NOTIFY_PHONES || "").trim();
    if (envList) {
        return envList.split(",").map((s) => normalizePhone(s)).filter(Boolean);
    }
    return siteConfig.notifications.adminPhones;
}

function money(n) {
    return "৳ " + (Number(n) || 0).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

const METHOD_LABEL = {
    bkash: "bKash",
    nagad: "Nagad",
    rocket: "Rocket",
    cod: "Cash on Delivery",
    bank: "Bank Transfer"
};

/* Plain-text invoice shared by e-mails (customer + admin). */
function buildInvoiceText(order) {
    const lines = [];
    const c = order.customer || {};

    lines.push("MIZAN TRADE — ORDER INVOICE");
    lines.push("=".repeat(40));
    lines.push("Order Number : " + order.orderNumber);
    lines.push("Date         : " + new Date(order.createdAt).toLocaleString("en-GB"));
    lines.push("");
    lines.push("CUSTOMER");
    lines.push("-".repeat(40));
    lines.push("Name         : " + (c.name || "-"));
    lines.push("Mobile       : " + (c.phone || "-"));
    if (c.email) lines.push("Email        : " + c.email);
    lines.push("Address      : " + [c.address, c.village, c.thana, c.postOffice, c.district].filter(Boolean).join(", "));
    lines.push("Area         : " + (c.city || "-"));
    if (c.note) lines.push("Note         : " + c.note);
    lines.push("");
    lines.push("ITEMS");
    lines.push("-".repeat(40));

    (order.items || []).forEach((item, i) => {
        lines.push(
            (i + 1) + ". " + item.title +
            "  x" + item.quantity +
            "  @ " + money(item.price) +
            "  = " + money(item.price * item.quantity)
        );
    });

    lines.push("");
    lines.push("Subtotal        : " + money(order.subtotal));
    lines.push("Delivery Charge : " + money(order.shippingFee) + " (" + (c.city || "-") + ")");
    if (order.discount > 0) {
        lines.push("Discount" + (order.couponCode ? " (" + order.couponCode + ")" : "") + "  : -" + money(order.discount));
    }
    if (order.rewardPointsRedeemed > 0) {
        lines.push(
            "Reward Points (" + order.rewardPointsRedeemed + ")" +
            "  : -" + money(order.rewardDiscount)
        );
    }
    if (order.taxAmount > 0) {
        lines.push(
            (order.taxLabel || "Tax") +
            (order.taxIncluded ? " (included)" : "") +
            "  : " + (order.taxIncluded ? "" : "+") + money(order.taxAmount)
        );
    }
    if (order.paymentCharge > 0) {
        lines.push("Payment Charge  : " + money(order.paymentCharge));
    }
    lines.push("-".repeat(40));
    lines.push("TOTAL           : " + money(order.total));
    if (order.rewardPointsEarned > 0) {
        lines.push("Reward Earned   : +" + order.rewardPointsEarned + " points");
    }
    lines.push("Payment Method  : " + (METHOD_LABEL[order.paymentMethod] || order.paymentMethod));
    if (order.paymentInfo && order.paymentInfo.trxId) {
        lines.push("TrxID           : " + order.paymentInfo.trxId);
    }
    lines.push("");
    lines.push("Track your order: " + (process.env.SITE_URL || "") + "/order-tracking");
    lines.push("Thank you for shopping with Mizan Trade!");

    return lines.join("\n");
}

function customerSmsText(order) {
    return orderConfirmedText(order);
}

function adminSmsText(order) {
    const amount = "Tk " + (Number(order.total) || 0).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    return ascii(
        "New MizanTrade order " + order.orderNumber +
        " - " + amount +
        " via " + (METHOD_LABEL[order.paymentMethod] || order.paymentMethod) +
        " from " + (order.customer && order.customer.phone ? order.customer.phone : "unknown")
    );
}

/* Fire all order notifications. Safe to await — resolves even on failures. */
async function notifyNewOrder(order, customerEmail) {
    const invoice = buildInvoiceText(order);
    const subject = "Order " + order.orderNumber + " — " + money(order.total);

    /* Admin e-mails */
    for (const email of adminEmails()) {
        const r = await sendMail({ to: email, subject, text: invoice });
        if (!r.ok) console.error("Admin order e-mail failed (" + email + "):", r.error);
    }

    /* Customer e-mail */
    const custEmail = (customerEmail || (order.customer && order.customer.email) || "").trim();
    if (custEmail) {
        const r = await sendMail({ to: custEmail, subject: "Your MizanTrade order " + order.orderNumber, text: invoice });
        if (!r.ok) console.error("Customer order e-mail failed:", r.error);
    }

    /* Admin SMS */
    for (const phone of adminPhones()) {
        const r = await sendSms(phone, adminSmsText(order));
        if (!r.ok) console.error("Admin order SMS failed (" + phone + "):", r.error);
    }

    /* Customer SMS */
    const custPhone = order.customer && order.customer.phone
        ? normalizePhone(order.customer.phone)
        : "";
    if (custPhone && /^01[3-9]\d{8}$/.test(custPhone)) {
        const r = await sendSms(custPhone, customerSmsText(order));
        if (!r.ok) console.error("Customer order SMS failed:", r.error);
    }
}

/* ======================================================
   LOGIN ALERTS — admin SMS + e-mail on every customer
   or partner sign-in. Never throws and never blocks the
   redirect: the caller can fire and forget.
====================================================== */

function dhakaTime(date) {
    return new Date(date || Date.now()).toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

/* SMS gateways bill per segment; keep alerts plain ASCII. */
function ascii(value) {
    return String(value || "")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function clip(value, max) {
    const text = String(value || "").trim();
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function clientIp(req) {
    if (!req) return "-";
    const forwarded = String((req.headers && req.headers["x-forwarded-for"]) || "")
        .split(",")[0]
        .trim();
    return forwarded || req.ip || "-";
}

function clientAgent(req) {
    return clip((req && req.headers && req.headers["user-agent"]) || "-", 200);
}

async function notifyAdmins(subject, text, smsText) {
    try {
        const tasks = [];

        adminEmails().forEach((email) => {
            tasks.push(
                sendMail({ to: email, subject, text })
                    .then((r) => {
                        if (!r.ok) console.error("Admin alert e-mail failed (" + email + "):", r.error);
                    })
                    .catch((err) => console.error("Admin alert e-mail failed (" + email + "):", err.message))
            );
        });

        adminPhones().forEach((phone) => {
            tasks.push(
                sendSms(phone, smsText)
                    .then((r) => {
                        if (!r.ok) console.error("Admin alert SMS failed (" + phone + "):", r.error);
                    })
                    .catch((err) => console.error("Admin alert SMS failed (" + phone + "):", err.message))
            );
        });

        await Promise.allSettled(tasks);
    } catch (err) {
        console.error("Admin alert error:", err.message);
    }
}

function notifyCustomerLogin(customer, req) {
    try {
        const name = (customer && customer.name) || "Customer";
        const email = (customer && customer.email) || "-";
        const phone = (customer && customer.phone) || "-";
        const provider = (customer && customer.authProvider) || "password";
        const when = dhakaTime();

        const lines = [
            "MIZAN TRADE — CUSTOMER LOGIN",
            "=".repeat(40),
            "Name     : " + name,
            "Mobile   : " + phone,
            "Email    : " + email,
            "Method   : " + provider,
            "Time     : " + when + " (Dhaka)",
            "IP       : " + clientIp(req),
            "Browser  : " + clientAgent(req),
            "",
            "Account  : " + (process.env.SITE_URL || "http://localhost:5000") + "/admin/customers"
        ];

        const sms = ascii(
            "MizanTrade customer login: " +
            clip(name, 40) +
            " (" + phone + ") via " + provider + " at " + when
        );

        return notifyAdmins("Customer login — " + clip(name, 60), lines.join("\n"), clip(sms, 160));
    } catch (err) {
        console.error("Customer login alert error:", err.message);
        return Promise.resolve();
    }
}

function notifyPartnerLogin(partner, req) {
    try {
        const company = (partner && partner.companyName) || "Partner";
        const owner = (partner && partner.ownerName) || "-";
        const email = (partner && partner.email) || "-";
        const phone = (partner && partner.phone) || "-";
        const when = dhakaTime();

        const lines = [
            "MIZAN TRADE — PARTNER LOGIN",
            "=".repeat(40),
            "Company  : " + company,
            "Owner    : " + owner,
            "Mobile   : " + phone,
            "Email    : " + email,
            "Time     : " + when + " (Dhaka)",
            "IP       : " + clientIp(req),
            "Browser  : " + clientAgent(req),
            "",
            "Portal   : " + (process.env.SITE_URL || "http://localhost:5000") + "/offers"
        ];

        const sms = ascii(
            "MizanTrade partner login: " +
            clip(company, 40) +
            " (" + phone + ") at " + when
        );

        return notifyAdmins("Partner login — " + clip(company, 60), lines.join("\n"), clip(sms, 160));
    } catch (err) {
        console.error("Partner login alert error:", err.message);
        return Promise.resolve();
    }
}

module.exports = {
    notifyNewOrder,
    buildInvoiceText,
    notifyCustomerLogin,
    notifyPartnerLogin
};
