const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const PartnerRequest = require("../models/PartnerRequest");
const Partner = require("../models/Partner");
const { notifyPartnerLogin } = require("../utils/notify");
const { cloudinary } = require("../middleware/upload");

/* Upload fields for the public partner form. Each field maps to a document
   label shown to the admin, and every field accepts several files. */
const DOCUMENT_FIELDS = [
    { name: "visitingCard", label: "Visiting Card", maxCount: 3 },
    { name: "tradeLicenseDoc", label: "Trade License", maxCount: 3 },
    { name: "binDoc", label: "BIN Certificate", maxCount: 3 },
    { name: "tinDoc", label: "TIN Certificate", maxCount: 3 },
    { name: "nidDoc", label: "NID / Passport", maxCount: 3 },
    { name: "ownerPhoto", label: "Owner Photo", maxCount: 2 },
    { name: "otherDocs", label: "Other Document", maxCount: 10 }
];

const REQUIRED_DOCUMENTS = ["visitingCard", "tradeLicenseDoc"];

const PROJECT_ROOT = path.join(__dirname, "..");
const PARTNER_DOC_ROOT = path.join(PROJECT_ROOT, "storage", "private", "partners");

exports.DOCUMENT_FIELDS = DOCUMENT_FIELDS;

function removeUploadedFiles(req) {
    const files = req.files || {};

    Object.keys(files).forEach(function (field) {
        (files[field] || []).forEach(function (file) {
            try {
                if (file.path) fs.unlinkSync(file.path);
            } catch (err) { /* already gone */ }
        });
    });
}

exports.cleanupPartnerUploads = removeUploadedFiles;

/* ======================================================
   PARTNER AUTH — separate realm from customers.
   Only admin-approved partner logins can enter /offers.
====================================================== */

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
    });
}

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
}

function renderPartnerLogin(res, status, message, notice, email) {
    return res.status(status).render("partnerLogin", {
        pageTitle: "Partner Login",
        message: message || "",
        notice: notice || "",
        email: email || ""
    });
}

exports.showPartnerLogin = (req, res) => {
    const message = String(req.query.message || "");

    let displayMessage = "";
    if (message === "partner_login_required") {
        displayMessage = "Partner login is required to view the offers portal.";
    }

    return renderPartnerLogin(res, 200, displayMessage, "", "");
};

exports.partnerLogin = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!email || !password) {
            return renderPartnerLogin(res, 400, "Please enter your e-mail and password.", "", email);
        }

        const partner = await Partner.findOne({ email }).select("+password");

        if (!partner) {
            return renderPartnerLogin(res, 401, "Invalid e-mail or password.", "", email);
        }

        if (!partner.isActive) {
            return renderPartnerLogin(res, 403, "This partner login has been disabled. Please contact us.", "", email);
        }

        // A login is only usable while its application is still approved.
        if (partner.partnerRequest) {
            const request = await PartnerRequest.findById(partner.partnerRequest).select("status");

            if (!request || request.status !== "Approved") {
                return renderPartnerLogin(
                    res,
                    403,
                    "Your partner application is not approved. Please wait for our team to review it.",
                    "",
                    email
                );
            }
        }

        const matched = await bcrypt.compare(password, partner.password);

        if (!matched) {
            return renderPartnerLogin(res, 401, "Invalid e-mail or password.", "", email);
        }

        await regenerateSession(req);

        req.session.partner = {
            id: partner._id.toString(),
            company: partner.companyName,
            email: partner.email
        };

        partner.lastLoginAt = new Date();
        await partner.save();

        await saveSession(req);

        notifyPartnerLogin(partner, req);

        return res.redirect("/offers");
    } catch (error) {
        console.error("Partner login error:", error);
        return renderPartnerLogin(res, 500, "Something went wrong. Please try again.", "", email);
    }
};

exports.partnerLogout = async (req, res) => {
    req.session.partner = null;
    await saveSession(req);
    return res.redirect("/partner/login");
};

/* ======================================================
   PUBLIC - PARTNER FORM
====================================================== */

function renderPartnerForm(res, status, options) {
    const opts = options || {};

    return res.status(status).render("partnerForm", {
        pageTitle: "Become a Partner",
        successMessage: null,
        errorMessage: opts.errorMessage || "",
        form: opts.form || {}
    });
}

exports.getPartnerForm = (req, res) => {
    res.render("partnerForm", {
        pageTitle: "Become a Partner",
        successMessage: req.query.success
            ? "Your application has been submitted successfully! We will review your documents and contact you."
            : null,
        errorMessage: "",
        form: {}
    });
};

exports.renderPartnerForm = renderPartnerForm;

exports.postPartnerForm = async (req, res) => {
    try {
        const {
            companyName,
            ownerName,
            email,
            phone,
            address,
            tradeLicense,
            businessDetails
        } = req.body;

        const form = {
            companyName: companyName || "",
            ownerName: ownerName || "",
            email: email || "",
            phone: phone || "",
            address: address || "",
            tradeLicense: tradeLicense || "",
            businessDetails: businessDetails || ""
        };

        if (!companyName || !ownerName || !email || !phone || !businessDetails) {
            return renderPartnerForm(res, 400, {
                errorMessage: "Please fill in all required fields.",
                form
            });
        }

        const uploaded = req.files || {};

        const missing = REQUIRED_DOCUMENTS.filter(function (field) {
            return !(uploaded[field] && uploaded[field].length);
        }).map(function (field) {
            const match = DOCUMENT_FIELDS.find(function (f) { return f.name === field; });
            return match ? match.label : field;
        });

        if (missing.length) {
            removeUploadedFiles(req);

            return renderPartnerForm(res, 400, {
                errorMessage: "Please upload: " + missing.join(", ") + ".",
                form
            });
        }

        const documents = [];

        DOCUMENT_FIELDS.forEach(function (field) {
            (uploaded[field.name] || []).forEach(function (file) {
                const relativePath = file.path
                    ? path.relative(PROJECT_ROOT, file.path).split(path.sep).join("/")
                    : "";

                documents.push({
                    label: field.label,
                    originalName: file.originalname,
                    filename: file.filename,
                    localPath: relativePath,
                    mimeType: file.mimetype,
                    size: file.size || 0,
                    uploadedAt: new Date()
                });
            });
        });

        await PartnerRequest.create({
            companyName: companyName.trim(),
            ownerName: ownerName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            address: (address || "").trim(),
            tradeLicense: (tradeLicense || "").trim(),
            businessDetails: businessDetails.trim(),
            documents
        });

        return res.redirect("/become-a-partner?success=true");
    } catch (error) {
        console.error("Partner form error:", error);
        removeUploadedFiles(req);

        return res
            .status(500)
            .send("Sorry, there was a server error. Please try again.");
    }
};

/* ======================================================
   ADMIN - PARTNER DETAIL & STATUS
====================================================== */

exports.getPartnerDetail = async (req, res) => {
    try {
        const partner = await PartnerRequest.findById(req.params.id).lean();

        if (!partner) {
            return res.status(404).send("Partner request not found.");
        }

        const login = await Partner.findOne({
            partnerRequest: partner._id
        }).lean();

        const loginNotice = req.session.partnerLoginNotice || "";
        req.session.partnerLoginNotice = null;

        return res.render("admin/partnerDetail", {
            pageTitle: "Partner Application",
            partner,
            login,
            loginNotice
        });
    } catch (error) {
        console.error("Partner detail error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postUpdatePartnerStatus = async (req, res) => {
    try {
        const { status, adminNote } = req.body;

        if (!["Pending", "Approved", "Rejected"].includes(status)) {
            return res.status(400).send("Invalid status.");
        }

        await PartnerRequest.findByIdAndUpdate(req.params.id, {
            status,
            adminNote: (adminNote || "").trim()
        });

        return res.redirect("/admin/partners/" + req.params.id);
    } catch (error) {
        console.error("Update partner status error:", error);
        return res.status(500).send("Unable to update status.");
    }
};

exports.deletePartner = async (req, res) => {
    try {
        const removed = await PartnerRequest.findByIdAndDelete(req.params.id).lean();

        if (removed) {
            (removed.documents || []).forEach(function (doc) {
                if (!doc.localPath) return;

                const absolute = path.resolve(PROJECT_ROOT, doc.localPath);
                if (!absolute.startsWith(PARTNER_DOC_ROOT + path.sep)) return;

                try { fs.unlinkSync(absolute); } catch (err) { /* already gone */ }
            });
        }

        return res.redirect("/admin/partners");
    } catch (error) {
        console.error("Delete partner error:", error);
        return res.status(500).send("Unable to delete application.");
    }
};

/* Documents live on Cloudinary. Older applications only stored the public id,
   so build a delivery URL for those. */
function documentUrl(doc) {
    if (!doc) return "";

    if (doc.url) return doc.url;

    if (doc.filename && /^https?:\/\//i.test(doc.filename)) {
        return doc.filename;
    }

    if (doc.filename) {
        const ext = (String(doc.originalName || "").match(/\.([a-z0-9]+)$/i) || [])[1];
        const options = { secure: true };

        if (ext && !/\.[a-z0-9]+$/i.test(doc.filename)) {
            options.format = ext;
        }

        return cloudinary.url(doc.filename, options);
    }

    return "";
}

exports.getPartnerDocument = async (req, res) => {
    try {
        const index = Number(req.params.index);

        if (!Number.isInteger(index) || index < 0) {
            return res.status(400).send("Invalid document.");
        }

        const request = await PartnerRequest
            .findById(req.params.id)
            .select("documents")
            .lean();

        if (!request) {
            return res.status(404).send("Partner request not found.");
        }

        const doc = (request.documents || [])[index];

        if (!doc) {
            return res.status(404).send("Document not found.");
        }

        const download = req.query.download === "1";

        if (doc.localPath) {
            const absolute = path.resolve(PROJECT_ROOT, doc.localPath);

            if (!absolute.startsWith(PARTNER_DOC_ROOT + path.sep) || !fs.existsSync(absolute)) {
                return res.status(404).send("This document file is missing on the server.");
            }

            const safeName = String(doc.originalName || doc.filename || "document")
                .replace(/["\r\n]/g, "");

            res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
            res.setHeader(
                "Content-Disposition",
                (download ? "attachment" : "inline") + '; filename="' + safeName + '"'
            );
            res.setHeader("Cache-Control", "private, no-store");

            return res.sendFile(absolute);
        }

        let url = documentUrl(doc);

        if (!url) {
            return res.status(404).send("This document is no longer available.");
        }

        if (download) {
            url = url.replace("/upload/", "/upload/fl_attachment/");
        }

        return res.redirect(url);
    } catch (error) {
        console.error("Partner document error:", error);
        return res.status(500).send("Unable to open document.");
    }
};

/* ======================================================
   ADMIN - PARTNER LOGIN MANAGEMENT
====================================================== */

function generatePassword() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
}

exports.createPartnerLogin = async (req, res) => {
    try {
        const request = await PartnerRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).send("Partner request not found.");
        }

        if (request.status !== "Approved") {
            req.session.partnerLoginNotice = "Only approved applications can receive a partner login.";
            return res.redirect("/admin/partners/" + req.params.id);
        }

        const existing = await Partner.findOne({ partnerRequest: request._id }).select("_id");
        if (existing) {
            return res.redirect("/admin/partners/" + req.params.id);
        }

        const email = request.email.trim().toLowerCase();

        const dup = await Partner.findOne({ email }).select("_id");
        if (dup) {
            req.session.partnerLoginNotice = "A partner login with this e-mail already exists.";
            return res.redirect("/admin/partners/" + req.params.id);
        }

        let password = String(req.body.password || "").trim();
        const generated = !password;

        if (generated) password = generatePassword();

        if (password.length < 6) {
            req.session.partnerLoginNotice = "Password must be at least 6 characters.";
            return res.redirect("/admin/partners/" + req.params.id);
        }

        const hashed = await bcrypt.hash(password, 10);

        await Partner.create({
            partnerRequest: request._id,
            companyName: request.companyName,
            ownerName: request.ownerName,
            email,
            phone: request.phone,
            password: hashed,
            isActive: true,
            approvedAt: new Date()
        });

        req.session.partnerLoginNotice = generated
            ? "Partner login created for " + email + ". Temporary password: " + password + " — share it securely and ask them to change it."
            : "Partner login created for " + email + ".";

        return res.redirect("/admin/partners/" + req.params.id);
    } catch (error) {
        console.error("Create partner login error:", error);
        return res.status(500).send("Unable to create the partner login.");
    }
};

exports.togglePartnerLoginStatus = async (req, res) => {
    try {
        const partner = await Partner.findOne({ partnerRequest: req.params.id });

        if (!partner) {
            return res.status(404).send("Partner login not found.");
        }

        partner.isActive = !partner.isActive;
        await partner.save();

        req.session.partnerLoginNotice = partner.isActive
            ? "Partner login enabled."
            : "Partner login disabled — they can no longer sign in.";

        return res.redirect("/admin/partners/" + req.params.id);
    } catch (error) {
        console.error("Toggle partner login error:", error);
        return res.status(500).send("Unable to update the partner login.");
    }
};

exports.resetPartnerPassword = async (req, res) => {
    try {
        const partner = await Partner.findOne({ partnerRequest: req.params.id }).select("+password");

        if (!partner) {
            return res.status(404).send("Partner login not found.");
        }

        let password = String(req.body.password || "").trim();
        const generated = !password;

        if (generated) password = generatePassword();

        if (password.length < 6) {
            req.session.partnerLoginNotice = "Password must be at least 6 characters.";
            return res.redirect("/admin/partners/" + req.params.id);
        }

        partner.password = await bcrypt.hash(password, 10);
        await partner.save();

        req.session.partnerLoginNotice = generated
            ? "New temporary password for " + partner.email + ": " + password + " — share it securely."
            : "Password updated for " + partner.email + ".";

        return res.redirect("/admin/partners/" + req.params.id);
    } catch (error) {
        console.error("Reset partner password error:", error);
        return res.status(500).send("Unable to reset the password.");
    }
};