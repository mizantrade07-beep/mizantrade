const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");


/* ======================================================
   SHOW LOGIN PAGE
====================================================== */

async function showLogin(req, res) {
    const message = String(
        req.query.message || ""
    );

    let displayMessage = "";

    if (message === "login_required") {
        displayMessage =
            "Please login to access the admin dashboard.";
    }

    if (message === "logout_success") {
        displayMessage =
            "You have been logged out successfully.";
    }

    return res.render(
        "admin/auth/login",
        {
            pageTitle: "Admin Login",
            message: displayMessage
        }
    );
}


/* ======================================================
   ADMIN LOGIN
====================================================== */

async function login(req, res) {
    try {
        const email = String(
            req.body.email || ""
        )
            .trim()
            .toLowerCase();

        const password = String(
            req.body.password || ""
        );

        if (!email || !password) {
            return res.status(400).render(
                "admin/auth/login",
                {
                    pageTitle: "Admin Login",
                    message:
                        "Email and password are required."
                }
            );
        }

        const admin = await Admin.findOne({
            email
        }).select("+password");

        if (!admin) {
            return res.status(401).render(
                "admin/auth/login",
                {
                    pageTitle: "Admin Login",
                    message:
                        "Invalid email or password."
                }
            );
        }

        if (!admin.isActive) {
            return res.status(403).render(
                "admin/auth/login",
                {
                    pageTitle: "Admin Login",
                    message:
                        "This admin account is inactive."
                }
            );
        }

        const passwordMatched =
            await bcrypt.compare(
                password,
                admin.password
            );

        if (!passwordMatched) {
            return res.status(401).render(
                "admin/auth/login",
                {
                    pageTitle: "Admin Login",
                    message:
                        "Invalid email or password."
                }
            );
        }


        /* ==================================================
           REGENERATE SESSION
        ================================================== */

        await new Promise(
            (resolve, reject) => {
                req.session.regenerate(
                    (error) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve();
                    }
                );
            }
        );


        /* ==================================================
           SAVE ADMIN IN SESSION
        ================================================== */

        req.session.admin = {
            id: admin._id.toString(),
            name: admin.name,
            email: admin.email,
            role: admin.role
        };


        /* ==================================================
           UPDATE LAST LOGIN
        ================================================== */

        admin.lastLoginAt = new Date();

        await admin.save();


        /* ==================================================
           SAVE SESSION
        ================================================== */

        await new Promise(
            (resolve, reject) => {
                req.session.save(
                    (error) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve();
                    }
                );
            }
        );


        /* ==================================================
           REDIRECT
        ================================================== */

        return res.redirect(
            "/admin/dashboard"
        );

    } catch (error) {

        console.error(
            "ADMIN LOGIN ERROR:"
        );

        console.error(error);

        return res.status(500).render(
            "admin/auth/login",
            {
                pageTitle: "Admin Login",
                message:
                    "Something went wrong. Please try again."
            }
        );
    }
}


/* ======================================================
   LOGOUT
====================================================== */

async function logout(req, res) {

    req.session.destroy(
        (error) => {

            if (error) {
                console.error(
                    "LOGOUT ERROR:"
                );

                console.error(error);
            }

            res.clearCookie(
                "mizantrade.sid"
            );

            return res.redirect(
                "/admin/login?message=logout_success"
            );
        }
    );
}


module.exports = {
    showLogin,
    login,
    logout
};