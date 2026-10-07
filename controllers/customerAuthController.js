const bcrypt = require("bcryptjs");

const Customer = require("../models/Customer");
const Order = require("../models/Order");

/* Convert session.regenerate/save callbacks into Promises */
function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
    });
}

function setCustomerSession(req, customer) {
    req.session.customer = {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        phone: customer.phone || ""
    };
}

/* ======================================================
   SIGNUP
====================================================== */

exports.showSignup = (req, res) => {
    return res.render("account/signup", {
        pageTitle: "Create Account",
        message: "",
        form: {}
    });
};

exports.signup = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            confirmPassword,
            address,
            city,
            district,
            postalCode,
            gender,
            dateOfBirth
        } = req.body;

        const form = req.body;

        if (!name || !name.trim() || !email || !password) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "Name, email, and password are required.",
                form
            });
        }

        if (String(password).length < 6) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "Password must be at least 6 characters long.",
                form
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "The passwords do not match.",
                form
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const exists = await Customer.findOne({
            email: cleanEmail
        }).select("_id");

        if (exists) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "An account with this email already exists. Please log in.",
                form
            });
        }

        const hashed = await bcrypt.hash(String(password), 10);

        const customer = await Customer.create({
            name: name.trim(),
            email: cleanEmail,
            phone: (phone || "").trim(),
            password: hashed,
            address: (address || "").trim(),
            city: (city || "").trim(),
            district: (district || "").trim(),
            postalCode: (postalCode || "").trim(),
            gender: gender || "",
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
        });

        await regenerateSession(req);

        setCustomerSession(req, customer);

        await saveSession(req);

        return res.redirect("/account");
    } catch (error) {
        console.error("Customer signup error:", error);

        if (error.code === 11000) {
            return res.status(400).render("account/signup", {
                pageTitle: "Create Account",
                message: "This email is already registered.",
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
   LOGIN
====================================================== */

exports.showLogin = (req, res) => {
    const message = String(req.query.message || "");

    let displayMessage = "";

    if (message === "login_required") {
        displayMessage = "Please log in first to view this page.";
    }

    return res.render("account/login", {
        pageTitle: "Customer Login",
        message: displayMessage
    });
};

exports.login = async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).render("account/login", {
                pageTitle: "Customer Login",
                message: "Please enter your email and password."
            });
        }

        const customer = await Customer.findOne({
            email
        }).select("+password");

        if (!customer) {
            return res.status(401).render("account/login", {
                pageTitle: "Customer Login",
                message: "Invalid email or password."
            });
        }

        if (!customer.isActive) {
            return res.status(403).render("account/login", {
                pageTitle: "Customer Login",
                message: "This account is inactive. Please contact the administrator."
            });
        }

        const matched = await bcrypt.compare(
            password,
            customer.password
        );

        if (!matched) {
            return res.status(401).render("account/login", {
                pageTitle: "Customer Login",
                message: "Invalid email or password."
            });
        }

        await regenerateSession(req);

        setCustomerSession(req, customer);

        await saveSession(req);

        customer.lastLoginAt = new Date();

        await customer.save();

        return res.redirect("/account");
    } catch (error) {
        console.error("Customer login error:", error);

        return res.status(500).render("account/login", {
            pageTitle: "Customer Login",
            message: "Something went wrong. Please try again."
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

        return res.render("account/dashboard", {
            pageTitle: "My Account",
            profile: customer,
            orders,
            updated: req.query.updated === "1"
        });
    } catch (error) {
        console.error("Customer account error:", error);

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
            if (String(newPassword).length < 6) {
                return res.status(400).send(
                    "New password must be at least 6 characters long. <a href='/account'>Go Back</a>"
                );
            }

            const withPassword = await Customer.findById(
                customer._id
            ).select("+password");

            const matched = await bcrypt.compare(
                String(currentPassword || ""),
                withPassword.password
            );

            if (!matched) {
                return res.status(400).send(
                    "Current password is incorrect. <a href='/account'>Go Back</a>"
                );
            }

            customer.password = await bcrypt.hash(
                String(newPassword),
                10
            );
        }

        await customer.save();

        setCustomerSession(req, customer);

        await saveSession(req);

        return res.redirect("/account?updated=1");
    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).send(
            "Unable to update profile."
        );
    }
};