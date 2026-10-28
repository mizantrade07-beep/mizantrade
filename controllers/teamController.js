const mongoose = require("mongoose");

const TeamMember = require("../models/TeamMember");
const siteConfig = require("../config/site");
const { buildSeo } = require("../utils/seo");
const { parseSocialLinks } = require("../utils/socialPlatforms");

function clean(value) {
    return String(value == null ? "" : value).trim();
}

function phoneNumber(value) {
    return clean(value).replace(/[^\d+]/g, "");
}

function buildMemberFields(body, file) {
    const parsed = parseSocialLinks(body);

    return {
        fields: {
            name: clean(body.name),
            designation: clean(body.designation),
            photo: file
                ? (file.path || file.secure_url || "")
                : clean(body.photo),
            phone: phoneNumber(body.phone),
            socials: parsed.socials,
            order: Number.isFinite(Number(body.order)) ? Number(body.order) : 0,
            isActive: body.isActive === "on" || body.isActive === "true"
        },
        invalidSocials: parsed.invalid,
        socialDrafts: parsed.drafts
    };
}

function formMember(fields, drafts) {
    return Object.assign({}, fields, {
        socials: drafts.length ? drafts : [{ platform: "", url: "" }]
    });
}

function validationMessage(fields, invalidSocials) {
    const problems = [];

    if (!fields.name) problems.push("Member name is required.");
    if (invalidSocials > 0) {
        problems.push("Some social links could not be read. Use a full https:// link or a plain username.");
    }

    return problems.join(" ");
}

/* ======================================================
   PUBLIC TEAM PAGE
====================================================== */

exports.getTeamPage = async (req, res) => {
    try {
        const members = await TeamMember.find({ isActive: { $ne: false } })
            .sort({ order: 1, createdAt: 1 })
            .lean();

        res.locals.seo = buildSeo({
            title: "Our Team - Mizan Trade",
            description: "Meet the Mizan Trade team — dedicated account managers and product specialists helping your IT business grow.",
            path: req.path,
            type: "website"
        });

        return res.render("team", {
            pageTitle: "Our Team",
            members,
            hotline: siteConfig.hotline,
            email: siteConfig.email
        });
    } catch (error) {
        console.error("Team page error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - TEAM MEMBERS
====================================================== */

exports.getTeamMembers = async (req, res) => {
    try {
        const members = await TeamMember.find({})
            .sort({ order: 1, createdAt: 1 })
            .lean();

        return res.render("admin/team", {
            pageTitle: "Team Members",
            members,
            totalActive: members.filter(function (m) { return m.isActive !== false; }).length,
            totalInactive: members.filter(function (m) { return m.isActive === false; }).length,
            message: req.query.message || ""
        });
    } catch (error) {
        console.error("getTeamMembers error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.getAddTeamMemberPage = (req, res) => {
    return res.render("admin/teamForm", {
        pageTitle: "Add Team Member",
        member: null
    });
};

exports.postAddTeamMember = async (req, res) => {
    try {
        const built = buildMemberFields(req.body, req.file);
        const fields = built.fields;
        const error = validationMessage(fields, built.invalidSocials);

        if (error) {
            return res.status(400).render("admin/teamForm", {
                pageTitle: "Add Team Member",
                member: formMember(fields, built.socialDrafts),
                error
            });
        }

        await TeamMember.create(fields);

        return res.redirect("/admin/team?message=added");
    } catch (error) {
        console.error("postAddTeamMember error:", error);
        const fallback = buildMemberFields(req.body, req.file);
        return res.status(500).render("admin/teamForm", {
            pageTitle: "Add Team Member",
            member: formMember(fallback.fields, fallback.socialDrafts),
            error: "Could not save the team member. Please try again."
        });
    }
};

exports.getEditTeamMemberPage = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).render("errors/404", { pageTitle: "Not Found" });
        }

        const member = await TeamMember.findById(req.params.id).lean();

        if (!member) {
            return res.status(404).render("errors/404", { pageTitle: "Not Found" });
        }

        return res.render("admin/teamForm", {
            pageTitle: "Edit Team Member",
            member,
            error: ""
        });
    } catch (error) {
        console.error("getEditTeamMemberPage error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postEditTeamMember = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).render("errors/404", { pageTitle: "Not Found" });
        }

        const built = buildMemberFields(req.body, req.file);
        const fields = built.fields;
        const error = validationMessage(fields, built.invalidSocials);

        if (error) {
            fields._id = req.params.id;
            return res.status(400).render("admin/teamForm", {
                pageTitle: "Edit Team Member",
                member: formMember(fields, built.socialDrafts),
                error
            });
        }

        const member = await TeamMember.findByIdAndUpdate(req.params.id, fields, {
            new: true
        });

        if (!member) {
            return res.status(404).render("errors/404", { pageTitle: "Not Found" });
        }

        return res.redirect("/admin/team?message=saved");
    } catch (error) {
        console.error("postEditTeamMember error:", error);
        const fallback = buildMemberFields(req.body, req.file);
        return res.status(500).render("admin/teamForm", {
            pageTitle: "Edit Team Member",
            member: Object.assign(formMember(fallback.fields, fallback.socialDrafts), {
                _id: req.params.id
            }),
            error: "Could not save the team member. Please try again."
        });
    }
};

exports.handlePhotoUploadError = function (err, req, res, next) {
    if (!err) return next();
    if (res.headersSent) return next(err);

    const isEdit = mongoose.isValidObjectId(req.params && req.params.id);
    const fallback = buildMemberFields(req.body || {}, null);

    let message = "Could not upload the photo. Please try again.";
    if (err.code === "LIMIT_FILE_SIZE") {
        message = "Photo is too large. Please upload a JPG, PNG or WEBP image up to 15 MB.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
        message = "Please upload a single photo file.";
    } else if (err.message) {
        message = err.message;
    }

    console.error("Team photo upload error:", err.code || err.message);

    return res.status(400).render("admin/teamForm", {
        pageTitle: isEdit ? "Edit Team Member" : "Add Team Member",
        member: Object.assign(
            formMember(fallback.fields, fallback.socialDrafts),
            isEdit ? { _id: req.params.id } : {}
        ),
        error: message
    });
};

exports.deleteTeamMember = async (req, res) => {
    try {
        if (mongoose.isValidObjectId(req.params.id)) {
            await TeamMember.findByIdAndDelete(req.params.id);
        }

        return res.redirect("/admin/team?message=deleted");
    } catch (error) {
        console.error("deleteTeamMember error:", error);
        return res.redirect("/admin/team?message=error");
    }
};
