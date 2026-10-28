const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { normalizePhone, isConfigured: isSmsConfigured, sendSms } = require("../utils/sms");
const { loginOtpText, signupOtpText } = require("../utils/smsTemplates");
const { sendMail, isMailConfigured } = require("../utils/mailer");
const { notifyCustomerLogin } = require("../utils/notify");
const oauth = require("../utils/oauth");
const siteConfig = require("../config/site");
const {
    regenerateSession,
    saveSession,
    setCustomerSession
} = require("../utils/customerSession");

/* Minimum password length comes from Settings → User & Security. */
function minPasswordLength() {
    const n = Number(siteConfig.userSecurity && siteConfig.userSecurity.passwordMinLength);
    return Number.isFinite(n) && n >= 4 ? Math.min(32, Math.floor(n)) : 6;
}

/* Security answers are compared case-insensitively after trimming. */
function normalizeAnswer(value) {
    return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function maskEmail(email) {
    const parts = String(email || "").split("@");
    if (parts.length !== 2 || !parts[0]) return String(email || "");
    return parts[0].slice(0, 1) + "***@" + parts[1];
}

function maskPhone(phone) {
    const value = normalizePhone(phone);
    if (value.length < 8) return value;
    return value.slice(0, 3) + "****" + value.slice(-4);
}

function nameFromEmail(email) {
    return String(email || "")
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()) || "Customer";
}

const SIGNUP_OTP_TTL_MS = 10 * 60 * 1000;
const SIGNUP_RESEND_MS = 60 * 1000;
const SIGNUP_MAX_ATTEMPTS = 5;

function renderSignup(res, status, message, form) {
    return res.status(status).render("account/signup", {
        pageTitle: "Create Account",
        message: message || "",
        form: form || {}
    });
}

function renderSignupVerify(res, status, pending, options) {
    const opts = options || {};

    return res.status(status).render("account/signupVerify", {
        pageTitle: "Verify Your Phone",
        message: opts.message || "",
        notice: opts.notice || "",
        phone: pending ? pending.phone : "",
        phoneMasked: maskPhone(pending ? pending.phone : ""),
        resendWait: pending && pending.sentAt
            ? Math.max(0, Math.ceil((SIGNUP_RESEND_MS - (Date.now() - pending.sentAt)) / 1000))
            : 0
    });
}

function signupFormFromPending(pending) {
    if (!pending) return {};

    return {
        firstName: pending.firstName || "",
        lastName: pending.lastName || "",
        email: pending.email || "",
        phone: pending.phone || ""
    };
}

function otpEmail(code) {
    return {
        subject: "Your MizanTrade login code",
        text:
            "Your MizanTrade verification code is " + code +
            ". It expires in 5 minutes. If you did not request this code, you can ignore this email.",
        html:
            '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#081621;">' +
            '<h2 style="margin:0 0 12px;color:#ef4a23;">MizanTrade</h2>' +
            "<p style=\"margin:0 0 8px;\">Your one-time login code is:</p>" +
            '<p style="font-size:30px;font-weight:800;letter-spacing:8px;margin:10px 0 18px;">' + code + "</p>" +
            '<p style="margin:0;font-size:13px;color:#64748b;">This code expires in 5 minutes. If you did not request it, you can ignore this email.</p>' +
            "</div>"
    };
}



/* ======================================================
   SIGNUP
====================================================== */

exports.showSignup = (req, res) => {
    return res.render("account/signup", {
        pageTitle: "Create Account",
        message: oauth.messageFor(req.query),
        form: {}
    });
};

exports.signup = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            privacy
        } = req.body;

        const form = req.body;

        if (
            !firstName || !String(firstName).trim() ||
            !lastName || !String(lastName).trim() ||
            !email || !String(email).trim() ||
            !phone || !String(phone).trim()
        ) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "First name, last name, e-mail and cell phone are all required.",
                form
            });
        }

        if (!privacy) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "Please agree to the Privacy Policy to continue.",
                form
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanPhone = normalizePhone(phone);

        if (!isValidEmail(cleanEmail)) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "Please enter a valid e-mail address.",
                form
            });
        }

        if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "Please enter a valid mobile number (01XXXXXXXXX).",
                form
            });
        }

        const exists = await Customer.findOne({
            $or: [
                { email: cleanEmail },
                { phone: cleanPhone }
            ]
        }).select("_id");

        if (exists) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "An account with this e-mail or phone number already exists. Please log in.",
                form
            });
        }

        if (!isSmsConfigured()) {
            return res.status(503).render("account/signup", {
                pageTitle: "Create Account",
                message: "Phone verification is temporarily unavailable. Please try again later or contact support.",
                form
            });
        }

        const previous = req.session.pendingSignup;

        if (previous && previous.phone === cleanPhone && previous.sentAt &&
            Date.now() - previous.sentAt < SIGNUP_RESEND_MS) {
            return renderSignupVerify(res, 429, previous, {
                message: "Please use the code we already sent to your phone, or wait a moment before requesting another one."
            });
        }

        const name = String(firstName).trim() + " " + String(lastName).trim();
        const code = String(crypto.randomInt(100000, 1000000));

        const pending = {
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            name,
            email: cleanEmail,
            phone: cleanPhone,
            code,
            expires: Date.now() + SIGNUP_OTP_TTL_MS,
            attempts: 0,
            sentAt: Date.now()
        };

        req.session.pendingSignup = pending;
        await saveSession(req);

        const result = await sendSms(cleanPhone, signupOtpText(code));

        if (!result.ok) {
            console.error("Signup OTP delivery failed:", result.error || result.body);
            req.session.pendingSignup = null;
            await saveSession(req);

            return res.status(502).render("account/signup", {
                pageTitle: "Create Account",
                message: "We could not send the verification code to your phone. Please try again.",
                form
            });
        }

        return res.redirect("/signup/verify");
    } catch (error) {
        console.error("Customer signup error:", error);

        if (error.code === 11000) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "This e-mail or phone number is already registered.",
                form: req.body
            });
        }

        return res.status(500).render("account/signup", {
            pageTitle: "Create Account",
            message: "Unable to create the account. Please try again.",
            form: req.body
        });
    }
};


/* ======================================================
   SIGNUP E-MAIL VERIFICATION
====================================================== */

exports.showSignupVerify = async (req, res) => {
    try {
        const pending = req.session.pendingSignup;

        if (!pending) {
            return res.redirect("/signup");
        }

        if (Date.now() > pending.expires) {
            req.session.pendingSignup = null;
            await saveSession(req);

            return renderSignup(res, 400,
                "Your verification code expired. Please sign up again.",
                signupFormFromPending(pending)
            );
        }

        return renderSignupVerify(res, 200, pending, {
            notice: "We've sent a verification code to your phone - " + pending.phone + ". Enter it below with your password to create your account."
        });
    } catch (error) {
        console.error("showSignupVerify error:", error);
        return res.redirect("/signup");
    }
};

exports.verifySignupOtp = async (req, res) => {
    try {
        const pending = req.session.pendingSignup;

        if (!pending) {
            return res.redirect("/signup");
        }

        if (Date.now() > pending.expires) {
            req.session.pendingSignup = null;
            await saveSession(req);

            return renderSignup(res, 400,
                "Your verification code expired. Please sign up again.",
                signupFormFromPending(pending)
            );
        }

        const code = String(req.body.code || "").trim();
        const password = String(req.body.password || "");
        const confirmPassword = String(req.body.confirmPassword || "");

        if (String(password).length < minPasswordLength()) {
            return renderSignupVerify(res, 400, pending, {
                message: "Password must be at least " + minPasswordLength() + " characters long."
            });
        }

        if (password !== confirmPassword) {
            return renderSignupVerify(res, 400, pending, {
                message: "The passwords do not match."
            });
        }

        if (!/^\d{6}$/.test(code)) {
            return renderSignupVerify(res, 400, pending, {
                message: "Enter the 6-digit code from your phone."
            });
        }

        if (pending.code !== code) {
            pending.attempts = (pending.attempts || 0) + 1;

            if (pending.attempts >= SIGNUP_MAX_ATTEMPTS) {
                req.session.pendingSignup = null;
                await saveSession(req);

                return renderSignup(res, 400,
                    "Too many incorrect codes. Please sign up again.",
                    signupFormFromPending(pending)
                );
            }

            await saveSession(req);

            return renderSignupVerify(res, 400, pending, {
                message: "Incorrect code. Please try again."
            });
        }

        let customer;

        try {
            customer = await Customer.create({
                name: pending.name,
                email: pending.email,
                phone: pending.phone,
                password: await bcrypt.hash(password, 10),
                authProvider: "password",
                emailVerified: false,
                phoneVerified: true
            });
        } catch (error) {
            if (error.code === 11000) {
                req.session.pendingSignup = null;
                await saveSession(req);

                return renderSignup(res, 400,
                    "An account with this e-mail or phone number already exists. Please log in.",
                    signupFormFromPending(pending)
                );
            }

            throw error;
        }

        req.session.pendingSignup = null;

        await regenerateSession(req);
        setCustomerSession(req, customer);
        await saveSession(req);

        customer.lastLoginAt = new Date();
        await customer.save();

        return res.redirect("/account");
    } catch (error) {
        console.error("verifySignupOtp error:", error);

        const pending = req.session.pendingSignup;

        if (pending) {
            return renderSignupVerify(res, 500, pending, {
                message: "Unable to create the account right now. Please try again."
            });
        }

        return res.redirect("/signup");
    }
};

exports.resendSignupOtp = async (req, res) => {
    try {
        const pending = req.session.pendingSignup;

        if (!pending) {
            return res.redirect("/signup");
        }

        const elapsed = Date.now() - (pending.sentAt || 0);

        if (elapsed < SIGNUP_RESEND_MS) {
            const wait = Math.ceil((SIGNUP_RESEND_MS - elapsed) / 1000);

            return renderSignupVerify(res, 429, pending, {
                message: "Please wait " + wait + " second" + (wait === 1 ? "" : "s") + " before requesting another code."
            });
        }

        if (!isSmsConfigured()) {
            return renderSignupVerify(res, 503, pending, {
                message: "SMS delivery is not configured. Please contact support."
            });
        }

        const code = String(crypto.randomInt(100000, 1000000));

        pending.code = code;
        pending.expires = Date.now() + SIGNUP_OTP_TTL_MS;
        pending.attempts = 0;
        pending.sentAt = Date.now();

        req.session.pendingSignup = pending;
        await saveSession(req);

        const result = await sendSms(pending.phone, signupOtpText(code));

        if (!result.ok) {
            console.error("Signup OTP resend failed:", result.error || result.body);

            return renderSignupVerify(res, 502, pending, {
                message: "Could not send a new code right now. Please try again later."
            });
        }

        return renderSignupVerify(res, 200, pending, {
            notice: "A new code was sent to " + pending.phone + "."
        });
    } catch (error) {
        console.error("resendSignupOtp error:", error);

        const pending = req.session.pendingSignup;

        if (pending) {
            return renderSignupVerify(res, 500, pending, {
                message: "Something went wrong. Please try again."
            });
        }

        return res.redirect("/signup");
    }
};

exports.cancelSignup = async (req, res) => {
    req.session.pendingSignup = null;
    await saveSession(req);
    return res.redirect("/signup");
};


/* ======================================================
   LOGIN
====================================================== */

// Only same-site paths may be used as a post-login destination.
function safeNext(value) {
    const next = String(value || "").trim();

    if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
        return "";
    }

    return next;
}

function renderLogin(res, status, options) {
    const opts = options || {};

    return res.status(status).render("account/login", {
        pageTitle: "Customer Login",
        message: opts.message || "",
        notice: opts.notice || "",
        next: opts.next || "",
        tab: opts.tab || "email",
        otpSent: Boolean(opts.otpSent),
        otpChannel: opts.otpChannel || "",
        otpTo: opts.otpTo || "",
        otpIdentifier: opts.otpIdentifier || "",
        otpEmailReady: isMailConfigured(),
        otpSmsReady: isSmsConfigured()
    });
}

exports.showLogin = (req, res) => {
    const message = String(req.query.message || "");

    let displayMessage = "";
    let notice = "";

    if (message === "login_required") {
        displayMessage = "Please log in first to view this page.";
    }
    if (message === "password_reset") {
        notice = "Your password has been reset. Please log in with your new password.";
    }

    const socialMessage = oauth.messageFor(req.query);

    if (socialMessage) {
        if (String(req.query.message || "") === "oauth_not_configured") {
            notice = socialMessage;
        } else {
            displayMessage = socialMessage;
        }
    }

    const tab = String(req.query.tab || "") === "otp" ? "otp" : "email";
    const next = safeNext(req.query.next);

    // Remember the return path only for this visit, so an old intent never leaks into a later login.
    req.session.loginNext = next || null;

    return renderLogin(res, 200, { message: displayMessage, notice, tab, next });
};

exports.login = async (req, res) => {
    try {
        const identifier = String(
            req.body.identifier || req.body.email || ""
        ).trim();

        const password = String(req.body.password || "");

        if (!identifier || !password) {
            return renderLogin(res, 400, {
                message: "Please enter your email (or mobile number) and password."
            });
        }

        let query;

        if (identifier.includes("@")) {
            query = { email: identifier.toLowerCase() };
        } else {
            const phone = normalizePhone(identifier);

            if (!/^01[3-9]\d{8}$/.test(phone)) {
                return renderLogin(res, 400, {
                    message: "Please enter a valid email address or mobile number (01XXXXXXXXX)."
                });
            }

            query = { phone };
        }

        const customer = await Customer.findOne(query).select("+password");

        if (!customer) {
            return renderLogin(res, 401, { message: "Invalid email or password." });
        }

        if (!customer.isActive) {
            return renderLogin(res, 403, {
                message: "This account is inactive. Please contact the administrator."
            });
        }

        if (!customer.password) {
            return renderLogin(res, 401, {
                message: "This account uses OTP or social sign-in. Please continue with that option."
            });
        }

        const matched = await bcrypt.compare(password, customer.password);

        if (!matched) {
            return renderLogin(res, 401, { message: "Invalid email or password." });
        }

        let verificationNotice = "";

        if (customer.authProvider === "password" &&
            !customer.emailVerified &&
            !customer.phoneVerified) {

            if (!customer.email || !isMailConfigured()) {
                verificationNotice =
                    "Your e-mail has not been verified yet because e-mail delivery is not set up. You can use your account now — we will ask you to verify once e-mail service is available.";
            } else {

                const current = req.session.loginOtp;

                if (current && current.channel === "email" &&
                    current.destination === customer.email && current.sentAt &&
                    Date.now() - current.sentAt < 60000) {
                    return otpView(res, 429, current, {
                        message: "Your e-mail is not verified. Please use the code we already sent, or wait a moment before requesting another one."
                    });
                }

                const code = String(crypto.randomInt(100000, 1000000));
                const otp = {
                    channel: "email",
                    destination: customer.email,
                    masked: maskEmail(customer.email),
                    input: customer.email,
                    code,
                    expires: Date.now() + 5 * 60 * 1000,
                    attempts: 0,
                    sentAt: Date.now(),
                    purpose: "login"
                };

                req.session.loginOtp = otp;
                await saveSession(req);

                const content = otpEmail(code);
                const result = await sendMail({
                    to: customer.email,
                    subject: content.subject,
                    text: content.text,
                    html: content.html
                });

                if (!result.ok) {
                    console.error("Unverified login OTP failed:", result.error || result.body);
                    req.session.loginOtp = null;
                    await saveSession(req);

                    return renderLogin(res, 502, {
                        message: "Your e-mail is not verified and we could not send a verification code. Please try again later."
                    });
                }

                return otpView(res, 200, otp, {
                    message: "Your e-mail is not verified yet. Enter the code we sent to " + otp.masked + " to verify your account and sign in."
                });
            }
        }

        // Read before regenerating: the new session would drop the return path.
        const destination =
            safeNext(req.body.next) ||
            safeNext(req.session.loginNext) ||
            "/account";

        // Regenerating rotates the session id, so carry the guest's cart/wishlist/compare over.
        const preserved = {
            cart: req.session.cart,
            wishlist: req.session.wishlist,
            compare: req.session.compare
        };

        await regenerateSession(req);

        if (preserved.cart) req.session.cart = preserved.cart;
        if (preserved.wishlist) req.session.wishlist = preserved.wishlist;
        if (preserved.compare) req.session.compare = preserved.compare;

        setCustomerSession(req, customer);

        if (verificationNotice) {
            req.session.customerAuthNotice = verificationNotice;
        }

        await saveSession(req);

        customer.lastLoginAt = new Date();

        await customer.save();

        notifyCustomerLogin(customer, req);

        return res.redirect(destination);
    } catch (error) {
        console.error("Customer login error:", error);

        return renderLogin(res, 500, { message: "Something went wrong. Please try again." });
    }
};

/* ======================================================
   EMAIL / WHATSAPP OTP LOGIN
====================================================== */

function otpView(res, status, otp, extra) {
    const options = Object.assign({
        tab: "otp",
        otpSent: Boolean(otp),
        otpChannel: otp ? otp.channel : "",
        otpTo: otp ? otp.masked : "",
        otpIdentifier: otp ? otp.input : ""
    }, extra || {});

    return renderLogin(res, status, options);
}

exports.sendOtp = async (req, res) => {
    try {
        const raw = String(
            req.body.identifier || req.body.email || req.body.phone || ""
        ).trim();

        if (!raw) {
            return otpView(res, 400, null, {
                message: "Enter your e-mail or mobile number."
            });
        }

        const current = req.session.loginOtp;
        if (current && current.sentAt && Date.now() - current.sentAt < 60000) {
            const wait = Math.ceil((60000 - (Date.now() - current.sentAt)) / 1000);
            return otpView(res, 429, current, {
                message: "Please wait " + wait + " second" + (wait === 1 ? "" : "s") + " before requesting another code."
            });
        }

        let channel = "";
        let destination = "";
        let masked = "";

        if (raw.includes("@")) {
            const email = raw.toLowerCase();

            if (!isValidEmail(email)) {
                return otpView(res, 400, null, {
                    message: "Please enter a valid e-mail address."
                });
            }

            if (!isMailConfigured()) {
                return otpView(res, 503, null, {
                    message: "E-mail OTP is not configured yet. Please use password login or contact support."
                });
            }

            const customer = await Customer.findOne({ email }).select("_id isActive");

            if (customer && !customer.isActive) {
                return otpView(res, 403, null, {
                    message: "This account is inactive. Please contact support."
                });
            }

            channel = "email";
            destination = email;
            masked = maskEmail(email);
        } else {
            const phone = normalizePhone(raw);

            if (!/^01[3-9]\d{8}$/.test(phone)) {
                return otpView(res, 400, null, {
                    message: "Enter a valid email address or mobile number (01XXXXXXXXX)."
                });
            }

            const customer = await Customer.findOne({ phone }).select("_id isActive");

            if (customer && !customer.isActive) {
                return otpView(res, 403, null, {
                    message: "This account is inactive. Please contact support."
                });
            }

            if (!isSmsConfigured()) {
                return otpView(res, 503, null, {
                    message: "SMS OTP is not available right now. Please use password login or contact support."
                });
            }

            channel = "sms";
            destination = phone;
            masked = maskPhone(phone);
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));

        const otp = {
            channel,
            destination,
            masked,
            input: raw,
            code,
            expires: Date.now() + 5 * 60 * 1000,
            attempts: 0,
            sentAt: Date.now(),
            purpose: "login"
        };

        req.session.loginOtp = otp;
        await saveSession(req);

        let result;

        if (channel === "email") {
            const content = otpEmail(code);
            result = await sendMail({
                to: destination,
                subject: content.subject,
                text: content.text,
                html: content.html
            });
        } else {
            result = await sendSms(destination, loginOtpText(code));
        }

        if (!result.ok) {
            console.error(
                "Login OTP delivery failed: code=" + (result.code || "-") + " " +
                (result.error || result.body)
            );
            req.session.loginOtp = null;
            await saveSession(req);

            return otpView(res, 502, null, {
                message: "Could not send the code right now. Please try again later."
            });
        }

        return otpView(res, 200, otp, {
            notice: "We sent a 6-digit code to " + masked + ". Enter it below."
        });
    } catch (error) {
        console.error("sendOtp error:", error);

        return otpView(res, 500, null, {
            message: "Something went wrong. Please try again."
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const code = String(req.body.code || "").trim();
        const otp = req.session.loginOtp;

        if (!otp || otp.purpose !== "login") {
            return otpView(res, 400, null, { message: "Please request a new code." });
        }

        if (Date.now() > otp.expires) {
            req.session.loginOtp = null;
            await saveSession(req);

            return otpView(res, 400, null, {
                message: "The code has expired. Please request a new one."
            });
        }

        if (otp.code !== code) {
            otp.attempts = (otp.attempts || 0) + 1;
            const exhausted = otp.attempts >= 4;

            if (exhausted) req.session.loginOtp = null;
            await saveSession(req);

            return otpView(res, 400, exhausted ? null : otp, {
                message: exhausted
                    ? "Too many wrong attempts. Please request a new code."
                    : "Incorrect code. Please try again."
            });
        }

        req.session.loginOtp = null;

        let customer;

        if (otp.channel === "email") {
            const email = otp.destination;
            customer = await Customer.findOne({ email });

            if (!customer) {
                customer = await Customer.create({
                    name: nameFromEmail(email),
                    email,
                    authProvider: "email",
                    emailVerified: true
                });
            } else {
                customer.emailVerified = true;
            }
        } else {
            const phone = otp.destination;
            customer = await Customer.findOne({ phone });

            if (!customer) {
                customer = await Customer.create({
                    name: "Customer " + phone.slice(-4),
                    phone,
                    authProvider: "phone",
                    phoneVerified: true
                });
            } else {
                customer.phoneVerified = true;
            }
        }

        if (!customer.isActive) {
            return otpView(res, 403, null, {
                message: "This account is inactive. Please contact support."
            });
        }

        await regenerateSession(req);
        setCustomerSession(req, customer);
        await saveSession(req);

        customer.lastLoginAt = new Date();
        await customer.save();

        notifyCustomerLogin(customer, req);

        return res.redirect("/account");
    } catch (error) {
        console.error("verifyOtp error:", error);

        return otpView(res, 500, null, {
            message: "Something went wrong. Please try again."
        });
    }
};

/* ======================================================
   FORGOT PASSWORD (security question reset)
====================================================== */

exports.showForgot = (req, res) => {
    return res.render("account/forgot", {
        pageTitle: "Forgot Password",
        message: "",
        step: "email",
        email: "",
        question: ""
    });
};

exports.forgotLookup = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();

        if (!email) {
            return res.status(400).render("account/forgot", {
                pageTitle: "Forgot Password",
                message: "Please enter your email address.",
                step: "email",
                email: "",
                question: ""
            });
        }

        const customer = await Customer.findOne({ email }).select("securityQuestion");

        if (!customer || !customer.securityQuestion) {
            return res.status(404).render("account/forgot", {
                pageTitle: "Forgot Password",
                message: "No recoverable account found for that email. Accounts created with social sign-in, or without a security question, cannot be reset here — please contact support.",
                step: "email",
                email,
                question: ""
            });
        }

        return res.render("account/forgot", {
            pageTitle: "Forgot Password",
            message: "",
            step: "answer",
            email,
            question: customer.securityQuestion
        });
    } catch (error) {
        console.error("forgotLookup error:", error);
        return res.status(500).render("account/forgot", {
            pageTitle: "Forgot Password",
            message: "Something went wrong. Please try again.",
            step: "email",
            email: "",
            question: ""
        });
    }
};

exports.forgotReset = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const newPassword = String(req.body.newPassword || "");
        const confirmPassword = String(req.body.confirmPassword || "");

        const customer = await Customer.findOne({ email })
            .select("+password +securityAnswer securityQuestion");

        if (!customer || !customer.securityAnswer) {
            return res.status(400).render("account/forgot", {
                pageTitle: "Forgot Password",
                message: "This account cannot be reset here. Please contact support.",
                step: "email",
                email,
                question: ""
            });
        }

        const matched = await bcrypt.compare(
            normalizeAnswer(req.body.answer),
            customer.securityAnswer
        );

        if (!matched) {
            return res.status(401).render("account/forgot", {
                pageTitle: "Forgot Password",
                message: "Incorrect answer. Please try again.",
                step: "answer",
                email,
                question: customer.securityQuestion
            });
        }

        if (newPassword.length < minPasswordLength()) {
            return res.status(400).render("account/forgot", {
                pageTitle: "Forgot Password",
                message: "New password must be at least " + minPasswordLength() + " characters long.",
                step: "answer",
                email,
                question: customer.securityQuestion
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).render("account/forgot", {
                pageTitle: "Forgot Password",
                message: "The passwords do not match.",
                step: "answer",
                email,
                question: customer.securityQuestion
            });
        }

        customer.password = await bcrypt.hash(newPassword, 10);
        await customer.save();

        return res.redirect("/login?message=password_reset");
    } catch (error) {
        console.error("forgotReset error:", error);
        return res.status(500).render("account/forgot", {
            pageTitle: "Forgot Password",
            message: "Something went wrong. Please try again.",
            step: "email",
            email: "",
            question: ""
        });
    }
};

/* ======================================================
   LOGOUT (Only removes the customer session,
   keeps cart/admin session data)
====================================================== */

exports.logout = async (req, res) => {
    req.session.customer = null;

    await saveSession(req);

    return res.redirect("/");
};

/* ======================================================
   ACCOUNT (Profile + Orders)
====================================================== */

exports.getAccount = async (req, res) => {
    try {
        const customer = await Customer.findById(
            req.session.customer.id
        ).lean();

        if (!customer) {
            return res.redirect("/login");
        }

        const orders = await Order.find({
            customerId: customer._id
        })
            .sort({ createdAt: -1 })
            .lean();

        const authNotice = req.session.customerAuthNotice || "";

        if (authNotice) {
            delete req.session.customerAuthNotice;
            await saveSession(req);
        }

        return res.render("account/dashboard", {
            pageTitle: "My Account",
            profile: customer,
            orders,
            authNotice,
            compareCount: Array.isArray(req.session.compare)
                ? req.session.compare.length
                : 0
        });
    } catch (error) {
        console.error("Customer account error:", error);

        return res.status(500).render("errors/500");
    }
};

exports.getAccountSettings = async (req, res) => {
    try {
        const customer = await Customer.findById(
            req.session.customer.id
        ).lean();

        if (!customer) {
            return res.redirect("/login");
        }

        return res.render("account/settings", {
            pageTitle: "Account Settings",
            profile: customer,
            updated: req.query.updated === "1"
        });
    } catch (error) {
        console.error("Customer settings error:", error);

        return res.status(500).render("errors/500");
    }
};

exports.postUpdateProfile = async (req, res) => {
    try {
        const customer = await Customer.findById(
            req.session.customer.id
        );

        if (!customer) {
            return res.redirect("/login");
        }

        const {
            name,
            phone,
            address,
            city,
            district,
            postalCode,
            gender,
            dateOfBirth,
            currentPassword,
            newPassword
        } = req.body;

        customer.name = name
            ? name.trim()
            : customer.name;

        customer.phone = (phone || "").trim();

        customer.address = (address || "").trim();

        customer.city = (city || "").trim();

        customer.district = (district || "").trim();

        customer.postalCode = (postalCode || "").trim();

        customer.gender = gender || "";

        customer.dateOfBirth = dateOfBirth
            ? new Date(dateOfBirth)
            : null;

        if (newPassword && String(newPassword).trim()) {
            if (String(newPassword).length < minPasswordLength()) {
                return res.status(400).send(
                    "New password must be at least " + minPasswordLength() + " characters long. <a href='/account'>Go Back</a>"
                );
            }

            const withPassword = await Customer.findById(
                customer._id
            ).select("+password");

            if (withPassword.password) {
                const matched = await bcrypt.compare(
                    String(currentPassword || ""),
                    withPassword.password
                );

                if (!matched) {
                    return res.status(400).send(
                        "Current password is incorrect. <a href='/account'>Go Back</a>"
                    );
                }
            }

            customer.password = await bcrypt.hash(
                String(newPassword),
                10
            );
        }

        await customer.save();

        setCustomerSession(req, customer);

        await saveSession(req);

        return res.redirect("/account/settings?updated=1");
    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).send(
            "Unable to update profile."
        );
    }
};