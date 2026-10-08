const path = require("path");
const fs = require("fs");

const PartnerRequest = require("../models/PartnerRequest");

/* ======================================================
   PUBLIC - PARTNER FORM
====================================================== */

exports.getPartnerForm = (req, res) => {
    res.render("partnerForm", {
        pageTitle: "Become a Partner",
        successMessage: req.query.success
            ? "Your application has been submitted successfully! We will review your documents and contact you."
            : null
    });
};

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

        if (!companyName || !ownerName || !email || !phone || !businessDetails) {
            return res.status(400).send(
                "Please fill in all required fields. <a href='/become-a-partner'>Go Back</a>"
            );
        }

        const documents = (req.files || []).map((file) => ({
            originalName: file.originalname,
            filename: file.filename,
            path: file.path || file.secure_url
        }));

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

        return res.render("admin/partnerDetail", {
            pageTitle: "Partner Application",
            partner
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
        await PartnerRequest.findByIdAndDelete(req.params.id);
        return res.redirect("/admin/partners");
    } catch (error) {
        console.error("Delete partner error:", error);
        return res.status(500).send("Unable to delete application.");
    }
};

// Document download handler for cloud storage
exports.getPartnerDocument = (req, res) => {
    try {
        return res.status(400).send("Document storage has been migrated to Cloudinary.");
    } catch (error) {
        console.error("Partner document error:", error);
        return res.status(500).send("Unable to download document.");
    }
};