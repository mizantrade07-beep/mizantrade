const { can, ROLE_LABELS } = require("./roles");

/* ======================================================
   ADMIN (স্টাফ) AUTH
====================================================== */

function requireAdmin(req, res, next) {
    if (
        req.session &&
        req.session.admin &&
        req.session.admin.id
    ) {
        return next();
    }

    return res.redirect(
        "/admin/login?message=login_required"
    );
}

function redirectIfAuthenticated(req, res, next) {
    if (
        req.session &&
        req.session.admin &&
        req.session.admin.id
    ) {
        return res.redirect("/admin/dashboard");
    }

    return next();
}

function attachAdmin(req, res, next) {
    const admin = req.session?.admin || null;

    res.locals.admin = admin;
    res.locals.currentRole = admin ? admin.role : null;
    res.locals.roleLabel = admin
        ? (ROLE_LABELS[admin.role] || admin.role)
        : null;

    // টেমপ্লেটে সহজে পারমিশন চেক: <% if (can('staff.manage')) { %>
    res.locals.can = function (action) {
        return admin ? can(admin.role, action) : false;
    };

    next();
}

/* ======================================================
   CUSTOMER AUTH
====================================================== */

function requireCustomer(req, res, next) {
    if (
        req.session &&
        req.session.customer &&
        req.session.customer.id
    ) {
        return next();
    }

    return res.redirect("/login?message=login_required");
}

function redirectIfCustomerAuthenticated(req, res, next) {
    if (
        req.session &&
        req.session.customer &&
        req.session.customer.id
    ) {
        return res.redirect("/account");
    }

    return next();
}

function attachCustomer(req, res, next) {
    res.locals.customer = req.session?.customer || null;
    next();
}

module.exports = {
    requireAdmin,
    redirectIfAuthenticated,
    attachAdmin,
    requireCustomer,
    redirectIfCustomerAuthenticated,
    attachCustomer
};
