const mongoose = require("mongoose");
const Product = require("../models/Product");

function flatten(filter) {
    // filter: "pending" | "approved" | "all"
    return async function () {
        const products = await Product.find({})
            .select("title slug reviews")
            .lean();

        const rows = [];

        products.forEach(function (p) {
            (p.reviews || []).forEach(function (r) {
                if (filter === "pending" && r.isApproved) return;
                if (filter === "approved" && !r.isApproved) return;

                rows.push({
                    productId: p._id,
                    productTitle: p.title,
                    productSlug: p.slug,
                    reviewId: r._id,
                    name: r.name,
                    rating: r.rating,
                    comment: r.comment,
                    isApproved: r.isApproved,
                    createdAt: r.createdAt
                });
            });
        });

        rows.sort(function (a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return rows;
    };
}

/* ======================================================
   ADMIN - REVIEW LIST
====================================================== */

exports.getReviews = async (req, res) => {
    try {
        const status = ["pending", "approved", "all"].indexOf(req.query.status) !== -1
            ? req.query.status
            : "pending";

        const listFn = flatten(status);
        const reviews = await listFn();

        // কাউন্ট (সব প্রোডাক্ট থেকে)
        const allFn = flatten("all");
        const pendingFn = flatten("pending");
        const [allRows, pendingRows] = await Promise.all([allFn(), pendingFn()]);

        return res.render("admin/reviews", {
            pageTitle: "Product Reviews",
            reviews,
            status,
            totalReviews: allRows.length,
            pendingTotal: pendingRows.length
        });
    } catch (error) {
        console.error("Admin review list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   HELPERS
====================================================== */

function validIds(productId, reviewId) {
    return (
        mongoose.Types.ObjectId.isValid(productId) &&
        mongoose.Types.ObjectId.isValid(reviewId)
    );
}

async function findReview(productId, reviewId) {
    const product = await Product.findById(productId);
    if (!product) return null;

    const review = product.reviews.id(reviewId);
    if (!review) return null;

    return { product, review };
}

/* ======================================================
   ADMIN - APPROVE / UPDATE / DELETE
====================================================== */

exports.approveReview = async (req, res) => {
    try {
        const { productId, reviewId } = req.params;
        if (!validIds(productId, reviewId)) {
            return res.status(400).send("Invalid review.");
        }

        const found = await findReview(productId, reviewId);
        if (!found) {
            return res.status(404).send("Review not found.");
        }

        found.review.isApproved = true;
        await found.product.save();

        return res.redirect(req.headers.referer || "/admin/reviews");
    } catch (error) {
        console.error("Approve review error:", error);
        return res.status(500).send("Could not approve the review.");
    }
};

exports.updateReview = async (req, res) => {
    try {
        const { productId, reviewId } = req.params;
        if (!validIds(productId, reviewId)) {
            return res.status(400).send("Invalid review.");
        }

        const found = await findReview(productId, reviewId);
        if (!found) {
            return res.status(404).send("Review not found.");
        }

        const name = String(req.body.name || "").trim();
        const comment = String(req.body.comment || "").trim();
        let rating = Number(req.body.rating);

        if (!name || !comment || !Number.isFinite(rating)) {
            return res.status(400).send("Please provide your name, rating, and comment correctly.");
        }

        rating = Math.min(5, Math.max(1, Math.round(rating)));

        found.review.name = name;
        found.review.comment = comment;
        found.review.rating = rating;

        if (req.body.isApproved === "on" || req.body.isApproved === "true") {
            found.review.isApproved = true;
        } else if (req.body.isApproved === "off") {
            found.review.isApproved = false;
        }

        await found.product.save();

        return res.redirect(req.headers.referer || "/admin/reviews");
    } catch (error) {
        console.error("Update review error:", error);
        return res.status(500).send("Could not update the review.");
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const { productId, reviewId } = req.params;
        if (!validIds(productId, reviewId)) {
            return res.status(400).send("Invalid review.");
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found.");
        }

        const review = product.reviews.id(reviewId);
        if (review) {
            review.deleteOne();
            await product.save();
        }

        return res.redirect(req.headers.referer || "/admin/reviews");
    } catch (error) {
        console.error("Delete review error:", error);
        return res.status(500).send("Could not delete the review.");
    }
};
