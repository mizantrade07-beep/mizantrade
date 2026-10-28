/* ======================================================
   Customer SMS bodies
   Kept ASCII-only on purpose: the ৳ sign forces the gateway
   into UCS-2, which doubles the number of billable segments.
====================================================== */

const siteConfig = require("../config/site");

function siteUrl() {
    return String(process.env.SITE_URL || "https://mizantrade.com")
        .trim()
        .replace(/\/+$/, "");
}

function trackUrl() {
    return siteUrl() + "/order-tracking";
}

function money(value) {
    return "Tk " + (Number(value) || 0).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function hotline() {
    return String(siteConfig.hotline || "").replace(/\s+/g, "");
}

/* 1. Login OTP */
function loginOtpText(code) {
    return (
        "MizanTrade: Your login code is " + code +
        ". It expires in 5 minutes. Never share this code with anyone."
    );
}

/* 2. Signup phone verification OTP */
function signupOtpText(code) {
    return (
        "MizanTrade: Your account verification code is " + code +
        ". It expires in 10 minutes. Never share this code with anyone."
    );
}

/* 3. Order verification OTP (checkout) */
function orderOtpText(code) {
    return (
        "MizanTrade: Your order verification code is " + code +
        ". It expires in 5 minutes. Never share it with anyone."
    );
}

/* 4. Order confirmation */
function orderConfirmedText(order) {
    return (
        "MizanTrade: Thank you for your order! Order No: " + order.orderNumber +
        ". Total: " + money(order.total) +
        ". Track: " + trackUrl()
    );
}

/* 5. Order status update */
function orderStatusText(order) {
    return (
        "MizanTrade: Order " + order.orderNumber + " is now " + order.status +
        ". Track: " + trackUrl() +
        ". Hotline: " + hotline()
    );
}

module.exports = {
    loginOtpText,
    signupOtpText,
    orderOtpText,
    orderConfirmedText,
    orderStatusText
};
