const Post = require("../models/Post");
const Comment = require("../models/Comment");
const { createSlug, uniqueSlug } = require("../utils/slug");
const { can } = require("../middleware/roles");
const { buildSeo, baseUrl, absoluteUrl, stripHtml } = require("../utils/seo");

const PAGE_SIZE = 9;

function roleCanPublish(req) {
    const admin = req.session && req.session.admin;
    return admin ? can(admin.role, "content.publish") : false;
}

function resolveStatus(req, requested) {
    if (requested === "published" && roleCanPublish(req)) {
        return "published";
    }
    return "draft";
}

function parseTags(value) {
    if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
    return String(value || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
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

exports.getPosts = async (req, res) => {
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

        const posts = await Post.find(filter).sort({ createdAt: -1 }).lean();

        const totalPublished = await Post.countDocuments({ status: "published" });
        const totalDraft = await Post.countDocuments({ status: "draft" });

        return res.render("admin/posts", {
            pageTitle: "Posts",
            posts,
            search,
            status,
            totalPublished,
            totalDraft
        });
    } catch (error) {
        console.error("Admin post list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - ADD
====================================================== */

exports.getAddPostPage = (req, res) => {
    return res.render("admin/postForm", {
        pageTitle: "Add Post",
        post: null
    });
};

exports.postAddPost = async (req, res) => {
    try {
        const { title, slug, excerpt, content, author, tags, status, allowComments } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).send("Post title is required.");
        }

        const base = createSlug(slug || title);
        if (!base) {
            return res.status(400).send("A valid slug is required.");
        }

        const finalStatus = resolveStatus(req, status);

        await Post.create({
            title: title.trim(),
            slug: await uniqueSlug(Post, base),
            excerpt: String(excerpt || "").trim(),
            content: content || "",
            coverImage: req.file ? "/uploads/" + req.file.filename : "",
            tags: parseTags(tags),
            author: String(author || "Mizan Trade").trim(),
            status: finalStatus,
            publishedAt: finalStatus === "published" ? new Date() : null,
            allowComments: allowComments !== "off",
            seo: cleanSeo(req.body)
        });

        return res.redirect("/admin/posts");
    } catch (error) {
        console.error("Add post error:", error);
        if (error.code === 11000) {
            return res.status(400).send("This slug already exists.");
        }
        return res.status(500).send("Unable to create post.");
    }
};

/* ======================================================
   ADMIN - EDIT
====================================================== */

exports.getEditPostPage = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).lean();
        if (!post) {
            return res.status(404).send("Post not found.");
        }

        return res.render("admin/postForm", {
            pageTitle: "Edit Post",
            post
        });
    } catch (error) {
        console.error("Edit post load error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postEditPost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).send("Post not found.");
        }

        const { title, slug, excerpt, content, author, tags, status, allowComments } = req.body;

        post.title = title && title.trim() ? title.trim() : post.title;
        post.slug = await uniqueSlug(Post, createSlug(slug || post.title), post._id);
        post.excerpt = String(excerpt || "").trim();
        post.content = content || "";
        post.tags = parseTags(tags);
        post.author = String(author || post.author).trim();
        post.seo = cleanSeo(req.body);
        post.allowComments = allowComments !== "off";

        if (req.file) {
            post.coverImage = "/uploads/" + req.file.filename;
        }

        const requested = status || (post.status === "published" ? "published" : "draft");
        const newStatus = resolveStatus(req, requested);

        // প্রথমবার পাবলিশ হলে publishedAt সেট করা
        if (newStatus === "published" && !post.publishedAt) {
            post.publishedAt = new Date();
        }
        post.status = newStatus;

        await post.save();

        return res.redirect("/admin/posts");
    } catch (error) {
        console.error("Edit post error:", error);
        if (error.code === 11000) {
            return res.status(400).send("This slug already exists.");
        }
        return res.status(500).send("Unable to update post.");
    }
};

/* ======================================================
   ADMIN - DELETE
====================================================== */

exports.deletePost = async (req, res) => {
    try {
        await Comment.deleteMany({ post: req.params.id });
        await Post.findByIdAndDelete(req.params.id);
        return res.redirect("/admin/posts");
    } catch (error) {
        console.error("Delete post error:", error);
        return res.status(500).send("Unable to delete post.");
    }
};

/* ======================================================
   PUBLIC - BLOG LIST
====================================================== */

exports.getBlog = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
        const filter = { status: "published" };

        const total = await Post.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const currentPage = Math.min(page, totalPages);

        const posts = await Post.find(filter)
            .sort({ publishedAt: -1, createdAt: -1 })
            .skip((currentPage - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .lean();

        res.locals.seo = buildSeo({
            title: "Blog",
            description: "কম্পিউটার হার্ডওয়্যার, বিল্ড গাইড, অফার ও প্রযুক্তি টিপস নিয়ে মিজান ট্রেড ব্লগ।",
            path: "/blog"
        });

        return res.render("blog", {
            pageTitle: "Blog - Mizan Trade",
            posts,
            currentPage,
            totalPages
        });
    } catch (error) {
        console.error("Blog list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   PUBLIC - SINGLE POST
====================================================== */

exports.getPost = async (req, res, next) => {
    try {
        const post = await Post.findOne({ slug: req.params.slug, status: "published" });

        if (!post) {
            return next();
        }

        post.views = (post.views || 0) + 1;
        await post.save();

        const comments = await Comment.find({ post: post._id, isApproved: true })
            .sort({ createdAt: -1 })
            .lean();

        const description =
            (post.seo && post.seo.metaDescription) ||
            post.excerpt ||
            stripHtml(post.content).slice(0, 160);

        res.locals.seo = buildSeo({
            title: (post.seo && post.seo.metaTitle) || post.title,
            description,
            keywords: (post.seo && post.seo.keywords) || (post.tags || []).join(", "),
            path: "/blog/" + post.slug,
            image: post.coverImage || "/images/logo.svg",
            type: "article",
            jsonLd: {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: post.title,
                description: description,
                image: absoluteUrl(post.coverImage || "/images/logo.svg"),
                author: { "@type": "Organization", name: post.author || "Mizan Trade" },
                publisher: {
                    "@type": "Organization",
                    name: "Mizan Trade",
                    logo: { "@type": "ImageObject", url: baseUrl() + "/images/logo.svg" }
                },
                datePublished: post.publishedAt || post.createdAt,
                dateModified: post.updatedAt || post.publishedAt || post.createdAt,
                mainEntityOfPage: baseUrl() + "/blog/" + post.slug
            }
        });

        return res.render("blogPost", {
            pageTitle: (post.seo && post.seo.metaTitle) || post.title,
            post: post.toObject(),
            comments,
            metaDescription: (post.seo && post.seo.metaDescription) || post.excerpt || "",
            metaKeywords: (post.seo && post.seo.keywords) || (post.tags || []).join(", "),
            commentMessage: String(req.query.comment || "")
        });
    } catch (error) {
        console.error("Single post error:", error);
        return res.status(500).render("errors/500");
    }
};
