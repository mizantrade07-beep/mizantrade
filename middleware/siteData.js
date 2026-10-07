const Category = require("../models/Category");
const Page = require("../models/Page");
const siteConfig = require("../config/site");
const { buildTree } = require("../utils/categoryTree");

// প্রতিটি পেজে কমন ডেটা (ক্যাটাগরি ট্রি, কার্ট/উইশলিস্ট কাউন্ট) পাঠানোর জন্য
async function siteData(req, res, next) {
    try {
        res.locals.site = siteConfig;
        const flatCategories = await Category
            .find({ isActive: true })
            .sort({ order: 1, name: 1 })
            .lean();

        const { tree } = buildTree(flatCategories);

        res.locals.categoryTree = tree;
        res.locals.allCategories = flatCategories;
        res.locals.currentPath = req.path;

        try {
            res.locals.footerPages = await Page
                .find({ status: "published", showInFooter: true })
                .sort({ title: 1 })
                .select("title slug")
                .lean();
        } catch (err) {
            console.error("footerPages load error:", err.message);
            res.locals.footerPages = [];
        }

        const cart = req.session.cart;
        res.locals.cartCount = cart
            ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
            : 0;

        res.locals.wishlistCount = req.session.wishlist
            ? req.session.wishlist.length
            : 0;

        next();
    } catch (error) {
        console.error("siteData middleware error:", error.message);
        next();
    }
}

module.exports = siteData;
