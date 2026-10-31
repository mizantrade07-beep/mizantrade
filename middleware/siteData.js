const Category = require("../models/Category");
const Page = require("../models/Page");
const siteConfig = require("../config/site");
const { buildTree } = require("../utils/categoryTree");
const cache = require("../utils/cache");
const {
    buildDefaults,
    getFooterContent,
    effectiveFooter
} = require("../utils/footerContent");

/* Shared data (category tree, footer, footer pages) is identical for every
   visitor and only changes when an admin saves. Cache it per process so a
   normal page render costs zero category/footer queries.

   Admin controllers call cache.del("site:...") after saving. */
const TTL = 120 * 1000;

function getCategories() {
    return cache.wrap("site:categories", TTL, async function () {
        const flat = await Category
            .find({ isActive: true })
            .sort({ order: 1, name: 1 })
            .lean();

        return {
            flat: flat,
            tree: buildTree(flat).tree
        };
    });
}

function getFooter() {
    return cache.wrap("site:footer", TTL, async function () {
        return effectiveFooter(await getFooterContent());
    });
}

function getFooterPages() {
    return cache.wrap("site:footerPages", TTL, function () {
        return Page
            .find({ status: "published", showInFooter: true })
            .sort({ title: 1 })
            .select("title slug")
            .lean();
    });
}

// প্রতিটি পেজে কমন ডেটা (ক্যাটাগরি ট্রি, কার্ট/উইশলিস্ট কাউন্ট) পাঠানোর জন্য
async function siteData(req, res, next) {
    try {
        res.locals.site = siteConfig;

        const categories = await getCategories();

        res.locals.categoryTree = categories.tree;
        res.locals.allCategories = categories.flat;
        res.locals.currentPath = req.path;

        if (!req.path.startsWith("/admin")) {
            try {
                res.locals.footer = await getFooter();
            } catch (err) {
                console.error("footer content load error:", err.message);
                res.locals.footer = effectiveFooter(buildDefaults());
            }

            try {
                res.locals.footerPages = await getFooterPages();
            } catch (err) {
                console.error("footerPages load error:", err.message);
                res.locals.footerPages = [];
            }
        }

        const cart = req.session.cart;
        res.locals.cartCount = cart
            ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
            : 0;

        res.locals.wishlistCount = req.session.wishlist
            ? req.session.wishlist.length
            : 0;

        res.locals.compareCount = Array.isArray(req.session.compare)
            ? req.session.compare.length
            : 0;

        /* First-time visitors have no session cookie yet, so their homepage
           is identical for everyone. Let the browser reuse it briefly instead
           of re-rendering on every back/forward navigation. Logged-in users
           (any cookie) always get a fresh render. */
        if (
            req.method === "GET" &&
            req.path === "/" &&
            !req.headers.cookie
        ) {
            res.setHeader(
                "Cache-Control",
                "private, max-age=30, stale-while-revalidate=120"
            );
        }

        next();
    } catch (error) {
        console.error("siteData middleware error:", error.message);
        next();
    }
}

siteData.getCategories = getCategories;
siteData.getFooter = getFooter;
siteData.getFooterPages = getFooterPages;

module.exports = siteData;
