const Faq = require("../models/Faq");
const { buildSeo, stripHtml } = require("../utils/seo");

/* ======================================================
   ADMIN - LIST (category অনুযায়ী গ্রুপ করা)
====================================================== */

exports.getFaqs = async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();

        const filter = {};
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ category: regex }, { question: regex }, { answer: regex }];
        }

        const faqs = await Faq.find(filter)
            .sort({ category: 1, order: 1, createdAt: 1 })
            .lean();

        const totalActive = await Faq.countDocuments({ isActive: true });
        const totalInactive = await Faq.countDocuments({ isActive: false });

        return res.render("admin/faqs", {
            pageTitle: "FAQ Manager",
            faqs,
            search,
            totalActive,
            totalInactive
        });
    } catch (error) {
        console.error("Admin FAQ list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - ADD / EDIT
====================================================== */

exports.getAddFaqPage = (req, res) => {
    return res.render("admin/faqForm", {
        pageTitle: "Add FAQ",
        faq: null
    });
};

exports.postAddFaq = async (req, res) => {
    try {
        const { category, question, answer, order, isActive } = req.body;

        if (!category || !category.trim() || !question || !question.trim() || !answer || !answer.trim()) {
            return res.status(400).send("Category, question and answer are all required.");
        }

        await Faq.create({
            category: category.trim(),
            question: question.trim(),
            answer: answer.trim(),
            order: Number(order) || 0,
            isActive: isActive === "on" || isActive === "true"
        });

        return res.redirect("/admin/faqs");
    } catch (error) {
        console.error("Add FAQ error:", error);
        return res.status(500).send("Unable to create FAQ.");
    }
};

exports.getEditFaqPage = async (req, res) => {
    try {
        const faq = await Faq.findById(req.params.id).lean();
        if (!faq) {
            return res.status(404).send("FAQ not found.");
        }

        return res.render("admin/faqForm", {
            pageTitle: "Edit FAQ",
            faq
        });
    } catch (error) {
        console.error("Edit FAQ load error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postEditFaq = async (req, res) => {
    try {
        const faq = await Faq.findById(req.params.id);
        if (!faq) {
            return res.status(404).send("FAQ not found.");
        }

        const { category, question, answer, order, isActive } = req.body;

        if (!category || !category.trim() || !question || !question.trim() || !answer || !answer.trim()) {
            return res.status(400).send("Category, question and answer are all required.");
        }

        faq.category = category.trim();
        faq.question = question.trim();
        faq.answer = answer.trim();
        faq.order = Number(order) || 0;
        faq.isActive = isActive === "on" || isActive === "true";

        await faq.save();

        return res.redirect("/admin/faqs");
    } catch (error) {
        console.error("Edit FAQ error:", error);
        return res.status(500).send("Unable to update FAQ.");
    }
};

/* ======================================================
   ADMIN - DELETE
====================================================== */

exports.deleteFaq = async (req, res) => {
    try {
        await Faq.findByIdAndDelete(req.params.id);
        return res.redirect("/admin/faqs");
    } catch (error) {
        console.error("Delete FAQ error:", error);
        return res.status(500).send("Unable to delete FAQ.");
    }
};

/* ======================================================
   PUBLIC - FAQ PAGE (ক্যাটাগরি অনুযায়ী গ্রুপ + সার্চ)
====================================================== */

exports.getPublicFaq = async (req, res) => {
    try {
        const faqs = await Faq.find({ isActive: true })
            .sort({ category: 1, order: 1, createdAt: 1 })
            .lean();

        const groups = [];
        const byCategory = new Map();

        faqs.forEach((f) => {
            if (!byCategory.has(f.category)) {
                const group = { category: f.category, items: [] };
                byCategory.set(f.category, group);
                groups.push(group);
            }
            byCategory.get(f.category).items.push(f);
        });

        res.locals.seo = buildSeo({
            title: "Frequently Asked Questions",
            description: "Find answers to common questions about Mizan Trade — ordering, payment methods, delivery, warranty, dealer registration and more.",
            path: "/faq"
        });

        return res.render("faq", {
            pageTitle: "Frequently Asked Questions",
            groups
        });
    } catch (error) {
        console.error("Public FAQ error:", error);
        return res.status(500).render("errors/500");
    }
};
