/* ======================================================
   ROLE & PERMISSION SYSTEM
   রোল: super_admin / admin (পূর্ণ ক্ষমতা), editor, sub_editor
   ডিফল্ট পারমিশন মডেল (ব্যবহারকারীর পছন্দ অনুযায়ী):
     - Admin      : সব কিছু (স্টাফ/সেটিংস/ডিলিট সহ)
     - Editor     : কনটেন্ট তৈরি-এডিট-পাবলিশ-ডিলিট, মডারেশন, কুপন, কাস্টমার ম্যানেজ
     - Sub-editor : শুধু তৈরি/এডিট ও দেখা — পাবলিশ/ডিলিট/অ্যাপ্রুভ করতে পারবে না
====================================================== */

const ROLES = ["super_admin", "admin", "editor", "sub_editor"];

const ROLE_LABELS = {
    super_admin: "Super Admin",
    admin: "Admin",
    editor: "Editor",
    sub_editor: "Sub-editor"
};

const ROLE_PERMISSIONS = {
    super_admin: ["*"],
    admin: ["*"],

    editor: [
        "content.create",
        "content.edit",
        "content.publish",
        "content.delete",
        "moderate",
        "coupons.manage",
        "customers.view",
        "customers.manage",
        "orders.view",
        "orders.manage",
        "analytics.view"
    ],

    sub_editor: [
        "content.create",
        "content.edit",
        "customers.view",
        "orders.view",
        "analytics.view"
    ]
};

function can(role, action) {
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.indexOf("*") !== -1 || perms.indexOf(action) !== -1;
}

function forbidden(req, res) {
    return res.status(403).render("errors/403", {
        pageTitle: "Access Denied"
    });
}

/* নির্দিষ্ট পারমিশন না থাকলে 403 */
function requirePermission(action) {
    return function (req, res, next) {
        const admin = req.session && req.session.admin;

        if (!admin || !admin.id) {
            return res.redirect("/admin/login?message=login_required");
        }

        if (can(admin.role, action)) {
            return next();
        }

        return forbidden(req, res);
    };
}

/* নির্দিষ্ট রোল না হলে 403 */
function requireRoles() {
    const roles = Array.prototype.slice.call(arguments);

    return function (req, res, next) {
        const admin = req.session && req.session.admin;

        if (!admin || !admin.id) {
            return res.redirect("/admin/login?message=login_required");
        }

        if (roles.indexOf(admin.role) !== -1) {
            return next();
        }

        return forbidden(req, res);
    };
}

module.exports = {
    ROLES,
    ROLE_LABELS,
    ROLE_PERMISSIONS,
    can,
    requirePermission,
    requireRoles
};
