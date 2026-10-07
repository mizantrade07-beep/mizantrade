const Comment = require("../models/Comment");
const Post = require("../models/Post");

/* ======================================================
   PUBLIC - SUBMIT COMMENT (Pending, requires admin approval)
====================================================== */

exports.postPublicComment = async (req, res) => {
    try {
        const post = await Post.findOne({
            slug: req.params.slug,
            status: "published"
        }).select("_id allowComments");

        if (!post) {
            return res.status(404).render("errors/404", {
                pageTitle: "Not Found"
            });
        }

        if (post.allowComments === false) {
            return res.redirect("/blog/" + post.slug + "?comment=closed");
        }

        const name = String(req.body.name || "").trim();
        const content = String(req.body.content || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();

        if (!name || !content) {
            return res.redirect(
                "/blog/" + req.params.slug + "?comment=error"
            );
        }

        const customer = req.session && req.session.customer;

        await Comment.create({
            post: post._id,
            customer: customer ? customer.id : null,
            name: customer ? customer.name : name,
            email: customer ? (customer.email || email) : email,
            content: content.slice(0, 2000),
            isApproved: false
        });

        return res.redirect(
            "/blog/" + req.params.slug + "?comment=pending"
        );
    } catch (error) {
        console.error("Public comment error:", error);

        return res.redirect(
            "/blog/" + req.params.slug + "?comment=error"
        );
    }
};

/* ======================================================
   ADMIN - MODERATION LIST
====================================================== */

exports.getComments = async (req, res) => {
    try {
        const filterParam = String(req.query.filter || "pending");

        const filter = {};

        if (filterParam === "pending") {
            filter.isApproved = false;
        } else if (filterParam === "approved") {
            filter.isApproved = true;
        }

        const comments = await Comment.find(filter)
            .populate("post", "title slug")
            .sort({ createdAt: -1 })
            .limit(300)
            .lean();

        const pendingCount = await Comment.countDocuments({
            isApproved: false
        });

        const approvedCount = await Comment.countDocuments({
            isApproved: true
        });

        return res.render("admin/comments", {
            pageTitle: "Comments",
            comments,
            filter: filterParam,
            pendingCount,
            approvedCount
        });
    } catch (error) {
        console.error("Admin comment list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - APPROVE
====================================================== */

exports.approveComment = async (req, res) => {
    try {
        await Comment.findByIdAndUpdate(req.params.id, {
            isApproved: true
        });

        return res.redirect(
            req.headers.referer || "/admin/comments"
        );
    } catch (error) {
        console.error("Approve comment error:", error);
        return res.status(500).send("Unable to approve comment.");
    }
};

/* ======================================================
   ADMIN - DELETE
====================================================== */

exports.deleteComment = async (req, res) => {
    try {
        await Comment.findByIdAndDelete(req.params.id);

        return res.redirect(
            req.headers.referer || "/admin/comments"
        );
    } catch (error) {
        console.error("Delete comment error:", error);
        return res.status(500).send("Unable to delete comment.");
    }
};