const Page = require("../models/Page");
const { createSlug, uniqueSlug } = require("../utils/slug");
const { can } = require("../middleware/roles");
const { buildSeo, stripHtml } = require("../utils/seo");

function roleCanPublish(req) {
    const admin = req.session && req.session.admin;
    return admin ? can(admin.role, "content.publish") : false;
}

/* স্ট্যাটাস নির্ধারণ — পাবলিশ পারমিশন না থাকলে draft-এ নামিয়ে আনা হয় */
function resolveStatus(req, requested) {
    if (requested === "published" && roleCanPublish(req)) {
        return "published";
    }
    return "draft";
}

function cleanSeo(body) {
    return {
        metaTitle: String(body.metaTitle || "").trim(),
        metaDescription: String(body.metaDescription || "").trim(),
        keywords: String(body.keywords || "").trim()
    };
}

/* ======================================================
   ADMIN - LIST
====================================================== */

exports.getPages = async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "").trim();

        const filter = {};
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ title: regex }, { slug: regex }];
        }
        if (status === "draft" || status === "published") {
            filter.status = status;
        }

        const pages = await Page.find(filter)
            .sort({ updatedAt: -1 })
            .lean();

        const totalPublished = await Page.countDocuments({ status: "published" });
        const totalDraft = await Page.countDocuments({ status: "draft" });

        return res.render("admin/pages", {
            pageTitle: "Pages",
            pages,
            search,
            status,
            totalPublished,
            totalDraft
        });
    } catch (error) {
        console.error("Admin page list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - ADD
====================================================== */

exports.getAddPagePage = (req, res) => {
    return res.render("admin/pageForm", {
        pageTitle: "Add Page",
        page: null
    });
};

exports.postAddPage = async (req, res) => {
    try {
        const { title, slug, excerpt, content, template, status, showInFooter } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).send("Page title is required.");
        }

        const base = createSlug(slug || title);
        if (!base) {
            return res.status(400).send("A valid slug is required.");
        }

        await Page.create({
            title: title.trim(),
            slug: await uniqueSlug(Page, base),
            excerpt: String(excerpt || "").trim(),
            content: content || "",
            featuredImage: req.file ? "/uploads/" + req.file.filename : "",
            template: template === "full" ? "full" : "info",
            status: resolveStatus(req, status),
            showInFooter: showInFooter === "on",
            seo: cleanSeo(req.body)
        });

        return res.redirect("/admin/pages");
    } catch (error) {
        console.error("Add page error:", error);
        if (error.code === 11000) {
            return res.status(400).send("This slug already exists.");
        }
        return res.status(500).send("Unable to create page.");
    }
};

/* ======================================================
   ADMIN - EDIT
====================================================== */

exports.getEditPagePage = async (req, res) => {
    try {
        const page = await Page.findById(req.params.id).lean();
        if (!page) {
            return res.status(404).send("Page not found.");
        }

        return res.render("admin/pageForm", {
            pageTitle: "Edit Page",
            page
        });
    } catch (error) {
        console.error("Edit page load error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postEditPage = async (req, res) => {
    try {
        const page = await Page.findById(req.params.id);
        if (!page) {
            return res.status(404).send("Page not found.");
        }

        const { title, slug, excerpt, content, template, status, showInFooter } = req.body;

        page.title = title && title.trim() ? title.trim() : page.title;
        page.slug = await uniqueSlug(Page, createSlug(slug || page.title), page._id);
        page.excerpt = String(excerpt || "").trim();
        page.content = content || "";
        page.template = template === "full" ? "full" : "info";
        page.showInFooter = showInFooter === "on";
        page.seo = cleanSeo(req.body);

        if (req.file) {
            page.featuredImage = "/uploads/" + req.file.filename;
        }

        // আগে published থাকলে এবং এখনো পাবলিশ পারমিশন না থাকলে আগের স্ট্যাটাস রাখা হয়
        const requested = status || (page.status === "published" ? "published" : "draft");
        page.status = resolveStatus(req, requested);

        await page.save();

        return res.redirect("/admin/pages");
    } catch (error) {
        console.error("Edit page error:", error);
        if (error.code === 11000) {
            return res.status(400).send("This slug already exists.");
        }
        return res.status(500).send("Unable to update page.");
    }
};

/* ======================================================
   ADMIN - DELETE
====================================================== */

exports.deletePage = async (req, res) => {
    try {
        await Page.findByIdAndDelete(req.params.id);
        return res.redirect("/admin/pages");
    } catch (error) {
        console.error("Delete page error:", error);
        return res.status(500).send("Unable to delete page.");
    }
};

/* ======================================================
   PUBLIC - RENDER PAGE BY SLUG
====================================================== */

exports.getPublicPage = async (req, res, next) => {
    try {
        const page = await Page.findOne({
            slug: req.params.slug,
            status: "published"
        }).lean();

        if (!page) {
            return next();
        }

        res.locals.seo = buildSeo({
            title: (page.seo && page.seo.metaTitle) || page.title,
            description: (page.seo && page.seo.metaDescription) || page.excerpt || stripHtml(page.content),
            keywords: (page.seo && page.seo.keywords) || "",
            path: "/page/" + page.slug,
            image: page.featuredImage || ""
        });

        return res.render("info", {
            pageTitle: (page.seo && page.seo.metaTitle) || page.title,
            page,
            metaDescription: (page.seo && page.seo.metaDescription) || page.excerpt || "",
            metaKeywords: (page.seo && page.seo.keywords) || ""
        });
    } catch (error) {
        console.error("Public page error:", error);
        return res.status(500).render("errors/500");
    }
};
