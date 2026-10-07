const Product = require("../models/Product");
const Category = require("../models/Category");
const Page = require("../models/Page");
const Post = require("../models/Post");
const { baseUrl, absoluteUrl } = require("../utils/seo");

/* স্ট্যাটিক ইনফো পেজ (webRoutes-এর infoPagePaths-এর সাথে মিল রেখে) */
const STATIC_PATHS = [
    "/shop",
    "/blog",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms",
    "/refund-policy",
    "/warranty",
    "/cookie-policy",
    "/services",
    "/order-procedure",
    "/delivery-method",
    "/our-brand"
];

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function urlNode(loc, lastmod, changefreq, priority) {
    let out = "    <url>\n";
    out += "        <loc>" + xmlEscape(loc) + "</loc>\n";
    if (lastmod) {
        const d = new Date(lastmod);
        if (!isNaN(d.getTime())) {
            out += "        <lastmod>" + d.toISOString() + "</lastmod>\n";
        }
    }
    if (changefreq) out += "        <changefreq>" + changefreq + "</changefreq>\n";
    if (priority) out += "        <priority>" + priority + "</priority>\n";
    out += "    </url>\n";
    return out;
}

/* ======================================================
   /sitemap.xml
====================================================== */
exports.getSitemap = async (req, res) => {
    try {
        const base = baseUrl();
        const nodes = [];

        // হোমপেজ
        nodes.push(urlNode(base + "/", null, "daily", "1.0"));

        // স্ট্যাটিক পেজ
        STATIC_PATHS.forEach((p) => {
            nodes.push(urlNode(base + p, null, "weekly", "0.6"));
        });

        const [products, categories, pages, posts] = await Promise.all([
            Product.find({ isActive: true }).select("slug updatedAt").lean(),
            Category.find({ isActive: true }).select("slug updatedAt").lean(),
            Page.find({ status: "published" }).select("slug updatedAt").lean(),
            Post.find({ status: "published" }).select("slug updatedAt publishedAt").lean()
        ]);

        categories.forEach((c) => {
            nodes.push(urlNode(absoluteUrl("/category/" + c.slug), c.updatedAt, "weekly", "0.7"));
        });

        products.forEach((p) => {
            nodes.push(urlNode(absoluteUrl("/product/" + p.slug), p.updatedAt, "weekly", "0.8"));
        });

        pages.forEach((pg) => {
            nodes.push(urlNode(absoluteUrl("/page/" + pg.slug), pg.updatedAt, "monthly", "0.5"));
        });

        posts.forEach((post) => {
            nodes.push(urlNode(absoluteUrl("/blog/" + post.slug), post.updatedAt || post.publishedAt, "monthly", "0.6"));
        });

        const xml =
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            nodes.join("") +
            "</urlset>\n";

        res.type("application/xml");
        return res.send(xml);
    } catch (error) {
        console.error("Sitemap error:", error);
        return res.status(500).type("text/plain").send("Sitemap unavailable");
    }
};

/* ======================================================
   /robots.txt
====================================================== */
exports.getRobots = (req, res) => {
    const base = baseUrl();
    const lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /cart",
        "Disallow: /checkout",
        "Disallow: /wishlist",
        "Disallow: /login",
        "Disallow: /signup",
        "Disallow: /account",
        "Disallow: /order/success",
        "",
        "Sitemap: " + base + "/sitemap.xml"
    ];
    res.type("text/plain");
    return res.send(lines.join("\n") + "\n");
};
