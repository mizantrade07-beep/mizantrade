const config = require("../config/env");
const siteConfig = require("../config/site");

/* ক্যানোনিকাল/সাইটম্যাপের জন্য বেস URL (env SITE_URL) */
function baseUrl() {
    return String(config.siteUrl || "").replace(/\/+$/, "");
}

/* abs URL না হলে বেস URL যোগ করে */
function absoluteUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return baseUrl() + (url.startsWith("/") ? url : "/" + url);
}

function stripHtml(html) {
    return String(html || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/* ======================================================
   buildSeo — অটো মেটা/OG/JSON-LD অবজেক্ট তৈরি করে
====================================================== */
function buildSeo(opts) {
    opts = opts || {};

    const base = baseUrl();
    const path = opts.path || "/";
    const siteName = siteConfig.siteName || "Mizan Trade";

    let title = opts.title || siteName;
    // টাইটেলে সাইট নাম না থাকলে যোগ করা (ব্র্যান্ডিং + SEO)
    if (opts.appendSiteName !== false && title.indexOf(siteName) === -1) {
        title = title + " | " + siteName;
    }
    title = String(title).slice(0, 70);

    let description = opts.description || "";
    if (!description && opts.content) {
        description = stripHtml(opts.content);
    }
    description = String(description).replace(/\s+/g, " ").trim().slice(0, 160);

    return {
        title,
        description,
        keywords: opts.keywords || "",
        canonical: opts.canonical || (base + path),
        image: absoluteUrl(opts.image || ""),
        type: opts.type || "website",
        noindex: !!opts.noindex,
        siteName,
        jsonLd: opts.jsonLd || null
    };
}

module.exports = { buildSeo, baseUrl, absoluteUrl, stripHtml };
