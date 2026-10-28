const { can, ROLE_LABELS } = require("./roles");

/* ======================================================
   ADMIN AUTH
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


/* ======================================================
   ATTACH ADMIN
====================================================== */

function attachAdmin(req, res, next) {
    const admin = req.session?.admin || null;

    res.locals.admin = admin;

    res.locals.currentRole = admin
        ? admin.role
        : null;

    res.locals.roleLabel = admin
        ? (ROLE_LABELS[admin.role] || admin.role)
        : null;

    res.locals.can = function (action) {
        return admin
            ? can(admin.role, action)
            : false;
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

    const returnTo = req.originalUrl || "";

    return res.redirect(
        "/login?message=login_required" +
        (returnTo.startsWith("/checkout") ? "&next=" + encodeURIComponent("/checkout") : "")
    );
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
    res.locals.customer =
        req.session?.customer || null;

    next();
}


/* ======================================================
   PARTNER — separate login realm for the offers portal.
   A customer session never grants partner access.
====================================================== */

// Owner-level admin accounts may open the partner-only live pages without a
// partner account. Editor / sub-editor accounts do not get this bypass.
function isAdminSession(req) {
    const admin = req.session && req.session.admin;

    return !!(
        admin &&
        admin.id &&
        (admin.role === "super_admin" || admin.role === "admin")
    );
}

function requirePartner(req, res, next) {
    if (isAdminSession(req)) {
        return next();
    }

    if (
        req.session &&
        req.session.partner &&
        req.session.partner.id
    ) {
        return next();
    }

    return res.redirect(
        "/partner/login?message=partner_login_required"
    );
}

function redirectIfPartnerAuthenticated(req, res, next) {
    if (isAdminSession(req)) {
        return res.redirect("/offers");
    }

    if (
        req.session &&
        req.session.partner &&
        req.session.partner.id
    ) {
        return res.redirect("/offers");
    }

    return next();
}


/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
    requireAdmin,
    redirectIfAuthenticated,
    attachAdmin,

    requireCustomer,
    redirectIfCustomerAuthenticated,
    attachCustomer,

    requirePartner,
    redirectIfPartnerAuthenticated
};