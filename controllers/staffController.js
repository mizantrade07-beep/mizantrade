const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");
const { ROLE_LABELS } = require("../middleware/roles");

/* নতুন স্টাফ তৈরিতে যেই রোলগুলো দেওয়া যাবে */
const ASSIGNABLE_ROLES = ["admin", "editor", "sub_editor"];

async function countActiveAdmins() {
    return Admin.countDocuments({
        isActive: true,
        role: { $in: ["super_admin", "admin"] }
    });
}

/* ======================================================
   STAFF LIST
====================================================== */

exports.getStaff = async (req, res) => {
    try {
        const staff = await Admin.find({})
            .sort({ createdAt: 1 })
            .lean();

        return res.render("admin/staff", {
            pageTitle: "Staff / Admin Users",
            staff,
            roleLabels: ROLE_LABELS,
            currentAdminId: req.session.admin.id
        });
    } catch (error) {
        console.error("Staff list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADD STAFF
====================================================== */

exports.getAddStaffPage = async (req, res) => {
    return res.render("admin/staffForm", {
        pageTitle: "Add Staff",
        staffMember: null,
        roles: ASSIGNABLE_ROLES,
        roleLabels: ROLE_LABELS
    });
};

exports.postAddStaff = async (req, res) => {
    try {
        const { name, email, password, role, isActive } = req.body;

        if (!name || !name.trim() || !email || !password) {
            return res.status(400).send("Name, email and password are required.");
        }

        if (ASSIGNABLE_ROLES.indexOf(role) === -1) {
            return res.status(400).send("Select a valid role.");
        }

        if (String(password).length < 6) {
            return res.status(400).send("Password must be at least 6 characters.");
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const exists = await Admin.findOne({ email: cleanEmail }).select("_id");
        if (exists) {
            return res.status(400).send("A staff member with this email already exists.");
        }

        const hashed = await bcrypt.hash(String(password), 10);

        await Admin.create({
            name: name.trim(),
            email: cleanEmail,
            password: hashed,
            role,
            isActive: isActive === "on"
        });

        return res.redirect("/admin/staff");
    } catch (error) {
        console.error("Add staff error:", error);

        if (error.code === 11000) {
            return res.status(400).send("This email already exists.");
        }

        return res.status(500).send("Unable to add staff.");
    }
};

/* ======================================================
   EDIT STAFF
====================================================== */

exports.getEditStaffPage = async (req, res) => {
    try {
        const staffMember = await Admin.findById(req.params.id).lean();

        if (!staffMember) {
            return res.status(404).send("Staff not found.");
        }

        // super_admin হলেও ড্রপডাউনে দেখানোর জন্য রোল লিস্টে রাখি
        const roles = ASSIGNABLE_ROLES.slice();
        if (staffMember.role === "super_admin") roles.unshift("super_admin");

        return res.render("admin/staffForm", {
            pageTitle: "Edit Staff",
            staffMember,
            roles,
            roleLabels: ROLE_LABELS
        });
    } catch (error) {
        console.error("Edit staff page error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postEditStaff = async (req, res) => {
    try {
        const target = await Admin.findById(req.params.id);

        if (!target) {
            return res.status(404).send("Staff not found.");
        }

        const { name, email, password, role, isActive } = req.body;

        const isSelf = String(target._id) === String(req.session.admin.id);
        const willBeActive = isActive === "on";
        const losingAdminPower =
            ["super_admin", "admin"].indexOf(target.role) !== -1 &&
            (["super_admin", "admin"].indexOf(role) === -1 || !willBeActive);

        // শেষ সক্রিয় অ্যাডমিনকে অ্যাডমিন-ক্ষমতা থেকে সরানো যাবে না
        if (losingAdminPower) {
            const activeAdmins = await countActiveAdmins();
            if (activeAdmins <= 1) {
                return res.status(400).send("The last active admin cannot be removed.");
            }
        }

        // নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না
        if (isSelf && !willBeActive) {
            return res.status(400).send("You cannot deactivate your own account.");
        }

        target.name = name ? name.trim() : target.name;
        target.email = email ? String(email).trim().toLowerCase() : target.email;
        target.role = role || target.role;
        target.isActive = willBeActive;

        if (password && String(password).trim()) {
            if (String(password).length < 6) {
                return res.status(400).send("Password must be at least 6 characters.");
            }
            target.password = await bcrypt.hash(String(password), 10);
        }

        await target.save();

        return res.redirect("/admin/staff");
    } catch (error) {
        console.error("Edit staff error:", error);

        if (error.code === 11000) {
            return res.status(400).send("This email already exists.");
        }

        return res.status(500).send("Unable to update staff.");
    }
};

/* ======================================================
   DELETE STAFF
====================================================== */

exports.deleteStaff = async (req, res) => {
    try {
        const target = await Admin.findById(req.params.id);

        if (!target) {
            return res.status(404).send("Staff not found.");
        }

        if (String(target._id) === String(req.session.admin.id)) {
            return res.status(400).send("You cannot delete your own account.");
        }

        if (["super_admin", "admin"].indexOf(target.role) !== -1 && target.isActive) {
            const activeAdmins = await countActiveAdmins();
            if (activeAdmins <= 1) {
                return res.status(400).send("The last active admin cannot be deleted.");
            }
        }

        await Admin.findByIdAndDelete(req.params.id);

        return res.redirect("/admin/staff");
    } catch (error) {
        console.error("Delete staff error:", error);
        return res.status(500).send("Unable to delete staff.");
    }
};
