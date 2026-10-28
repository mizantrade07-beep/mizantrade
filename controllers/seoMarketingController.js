const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const TrafficDaily = require("../models/TrafficDaily");
const TrafficVisitor = require("../models/TrafficVisitor");
const config = require("../config/env");
const { getSettingsDoc, saveSettings } = require("../utils/siteSettings");

const CORE_PAGES = [
    { path: "/", label: "Home" },
    { path: "/shop", label: "Shop" },
    { path: "/blog", label: "Blog" },
    { path: "/about", label: "About" },
    { path: "/contact", label: "Contact" },
    { path: "/offers", label: "Offers" },
    { path: "/team", label: "Team" },
    { path: "/faq", label: "FAQ" }
];

function str(value, max) {
    const out = value === undefined || value === null ? "" : String(value).trim();
    return max ? out.slice(0, max) : out;
}

function rowsOf(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : Object.values(value);
}

function bool(value) {
    return value === true || value === "on" || value === "true" || value === "1";
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function ymd(date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(date);
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function parseRange(q) {
    const today = new Date();
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    let to = valid.test(String(q.to || "")) ? new Date(q.to + "T23:59:59") : today;
    let from = valid.test(String(q.from || "")) ? new Date(q.from + "T00:00:00") : addDays(today, -29);
    if (from > to) {
        const t = from;
        from = to;
        to = t;
    }
    const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));
    return {
        from,
        to,
        prevFrom,
        prevTo,
        days,
        fromStr: ymd(from),
        toStr: ymd(to),
        prevFromStr: ymd(prevFrom),
        prevToStr: ymd(prevTo)
    };
}

function pctChange(current, previous) {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function trafficTotals(fromStr, toStr) {
    const rows = await TrafficDaily.find({ day: { $gte: fromStr, $lte: toStr } }).lean();
    return rows.reduce(function (acc, r) {
        acc.views += r.views || 0;
        acc.visitors += r.visitors || 0;
        acc.organic += r.organic || 0;
        acc.social += r.social || 0;
        acc.referral += r.referral || 0;
        return acc;
    }, { views: 0, visitors: 0, organic: 0, social: 0, referral: 0 });
}

function normPages(value) {
    return rowsOf(value)
        .map(function (r) {
            let path = str(r.path, 200) || "/";
            if (!path.startsWith("/")) path = "/" + path;
            path = path.replace(/(.)\/+$/, "$1");
            return {
                path,
                title: str(r.title, 70),
                description: str(r.description, 160),
                keywords: str(r.keywords, 300),
                robots: str(r.robots) === "noindex" ? "noindex" : "index",
                active: bool(r.active)
            };
        })
        .filter(function (r) {
            return r.title || r.description || r.keywords;
        })
        .filter(function (r, i, arr) {
            return arr.findIndex(function (x) { return x.path === r.path; }) === i;
        });
}

function healthReport(settings, seoPages) {
    const mk = settings.marketing || {};
    const coverMap = {};
    (seoPages || []).forEach(function (p) {
        if (p.active !== false) coverMap[p.path] = p;
    });
    const covered = CORE_PAGES.filter(function (p) {
        const row = coverMap[p.path];
        return row && row.title && row.description;
    }).length;

    const checks = [
        { key: "title", label: "Default meta title configured", pass: !!(settings.metaTitle && settings.metaTitle.length >= 15) },
        { key: "description", label: "Default meta description (50–160 characters)", pass: !!(settings.metaDescription && settings.metaDescription.length >= 50 && settings.metaDescription.length <= 160), hint: (settings.metaDescription || "").length + " chars" },
        { key: "favicon", label: "Favicon uploaded", pass: !!settings.faviconUrl },
        { key: "og", label: "Social share image (OG) set", pass: !!settings.ogImage },
        { key: "analytics", label: "Google Analytics 4 or Tag Manager connected", pass: !!(mk.ga4Id || mk.gtmId) },
        { key: "pixel", label: "Meta (Facebook) Pixel connected", pass: !!mk.fbPixelId },
        { key: "verify", label: "Google Search Console verification", pass: !!mk.googleVerification },
        { key: "coverage", label: "Core pages with custom title & description", pass: covered >= Math.ceil(CORE_PAGES.length / 2), hint: covered + "/" + CORE_PAGES.length },
        { key: "sitemap", label: "XML sitemap published", pass: true, hint: "/sitemap.xml" },
        { key: "robots", label: "Robots.txt published", pass: true, hint: "/robots.txt" },
        { key: "https", label: "Canonical site URL uses HTTPS", pass: /^https:/i.test(String(config.siteUrl || "")) }
    ];

    const passed = checks.filter(function (c) { return c.pass; }).length;
    const score = Math.round((passed / checks.length) * 100);
    let grade = "Needs work";
    if (score >= 85) grade = "Excellent";
    else if (score >= 65) grade = "Good";
    else if (score >= 40) grade = "Fair";

    return { checks, passed, total: checks.length, score, grade, covered, corePages: CORE_PAGES };
}

function monthlyOrders() {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    return Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Dhaka" } },
                orders: { $sum: 1 },
                revenue: { $sum: "$total" }
            }
        },
        { $sort: { _id: 1 } }
    ]);
}

async function reviewStats() {
    const rows = await Product.aggregate([
        { $unwind: "$reviews" },
        { $match: { "reviews.isApproved": true } },
        { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: "$reviews.rating" } } }
    ]);
    return rows[0] || { count: 0, avg: 0 };
}

/* ======================================================
   ADMIN - SEO & MARKETING (GET)
====================================================== */
exports.getSeoPage = async (req, res) => {
    try {
        const range = parseRange(req.query);
        const settings = await getSettingsDoc();
        const seoPages = (settings.seoPages || []).map(function (p) { return p.toObject ? p.toObject() : p; });
        const mk = settings.marketing || {};
        const leadStatuses = ["Confirmed", "Processing", "Shipped", "Delivered"];

        const [
            traffic,
            prevTraffic,
            orders,
            prevOrders,
            leads,
            prevLeads,
            newCustomers,
            prevCustomers,
            live,
            daily,
            months,
            reviews
        ] = await Promise.all([
            trafficTotals(range.fromStr, range.toStr),
            trafficTotals(range.prevFromStr, range.prevToStr),
            Order.countDocuments({ createdAt: { $gte: range.from, $lte: range.to } }),
            Order.countDocuments({ createdAt: { $gte: range.prevFrom, $lte: range.prevTo } }),
            Order.countDocuments({ createdAt: { $gte: range.from, $lte: range.to }, status: { $in: leadStatuses } }),
            Order.countDocuments({ createdAt: { $gte: range.prevFrom, $lte: range.prevTo }, status: { $in: leadStatuses } }),
            Customer.countDocuments({ createdAt: { $gte: range.from, $lte: range.to } }),
            Customer.countDocuments({ createdAt: { $gte: range.prevFrom, $lte: range.prevTo } }),
            TrafficVisitor.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 30 * 60 * 1000) } }),
            TrafficDaily.find({ day: { $gte: ymd(addDays(new Date(), -13)) } }).sort({ day: 1 }).lean(),
            monthlyOrders(),
            reviewStats()
        ]);

        const leadValue = await Order.aggregate([
            { $match: { createdAt: { $gte: range.from, $lte: range.to }, status: { $in: leadStatuses } } },
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]);

        const dayMap = {};
        daily.forEach(function (d) { dayMap[d.day] = d; });
        const series = [];
        for (let i = 13; i >= 0; i--) {
            const key = ymd(addDays(new Date(), -i));
            const row = dayMap[key] || {};
            series.push({
                day: key,
                label: key.slice(5),
                views: row.views || 0,
                visitors: row.visitors || 0,
                organic: row.organic || 0
            });
        }
        const maxViews = Math.max.apply(null, series.map(function (s) { return s.views; }).concat([1]));

        const monthMap = {};
        months.forEach(function (m) { monthMap[m._id] = m; });
        const monthly = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const key = ymd(d).slice(0, 7);
            const row = monthMap[key] || {};
            monthly.push({ key, label: key, orders: row.orders || 0, revenue: row.revenue || 0 });
        }
        const maxOrders = Math.max.apply(null, monthly.map(function (m) { return m.orders; }).concat([1]));
        const growth = monthly.length >= 2
            ? pctChange(monthly[monthly.length - 1].orders, monthly[monthly.length - 2].orders)
            : 0;

        const health = healthReport(settings, seoPages);

        return res.render("admin/seo", {
            pageTitle: "SEO & Marketing",
            active: "seo",
            settings,
            marketing: mk,
            seoPages,
            corePages: CORE_PAGES,
            range: {
                from: range.fromStr,
                to: range.toStr,
                days: range.days
            },
            kpi: {
                views: traffic.views,
                visitors: traffic.visitors,
                organic: traffic.organic,
                social: traffic.social,
                referral: traffic.referral,
                viewsChange: pctChange(traffic.views, prevTraffic.views),
                visitorsChange: pctChange(traffic.visitors, prevTraffic.visitors),
                organicChange: pctChange(traffic.organic, prevTraffic.organic),
                orders,
                ordersChange: pctChange(orders, prevOrders),
                leads,
                leadsChange: pctChange(leads, prevLeads),
                leadValue: leadValue[0] ? leadValue[0].total : 0,
                newCustomers,
                newCustomersChange: pctChange(newCustomers, prevCustomers),
                live,
                growth
            },
            series,
            maxViews,
            monthly,
            maxOrders,
            reviews,
            health,
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getSeoPage error:", error);
        return res.redirect("/admin/dashboard");
    }
};

/* ======================================================
   ADMIN - SEO & MARKETING (POST)
====================================================== */
exports.postSeoPage = async (req, res) => {
    try {
        const body = req.body || {};
        const current = await getSettingsDoc();
        const oldMk = current.marketing || {};

        const data = {
            seoPages: normPages(body.seoPages),
            marketing: {
                ga4Id: str(body["marketing.ga4Id"], 40),
                gtmId: str(body["marketing.gtmId"], 40),
                fbPixelId: str(body["marketing.fbPixelId"], 40),
                googleVerification: str(body["marketing.googleVerification"], 200),
                bingVerification: str(body["marketing.bingVerification"], 200),
                fbVerification: str(body["marketing.fbVerification"], 200),
                customHead: String(body["marketing.customHead"] || "").slice(0, 8000),
                customBody: String(body["marketing.customBody"] || "").slice(0, 8000),
                organicVisits: num(body["marketing.organicVisits"]),
                googleRanking: num(body["marketing.googleRanking"]),
                searchVisibility: Math.min(100, Math.max(0, num(body["marketing.searchVisibility"]))),
                brandCredibility: Math.min(100, Math.max(0, num(body["marketing.brandCredibility"]))),
                longTermGrowth: num(body["marketing.longTermGrowth"]),
                kpiNote: str(body["marketing.kpiNote"], 500),
                kpiUpdatedAt: oldMk.kpiUpdatedAt || null
            }
        };

        /* Manual KPIs carry a snapshot timestamp whenever they are edited. */
        if (
            body["marketing.googleRanking"] !== undefined ||
            body["marketing.searchVisibility"] !== undefined ||
            body["marketing.brandCredibility"] !== undefined ||
            body["marketing.longTermGrowth"] !== undefined ||
            body["marketing.organicVisits"] !== undefined
        ) {
            data.marketing.kpiUpdatedAt = new Date();
        }

        if (body.metaTitle !== undefined) data.metaTitle = str(body.metaTitle, 200);
        if (body.metaDescription !== undefined) data.metaDescription = str(body.metaDescription, 400);
        if (body.metaKeywords !== undefined) data.metaKeywords = str(body.metaKeywords, 400);
        if (body.ogImage !== undefined) data.ogImage = str(body.ogImage, 500);

        await saveSettings(data);
        return res.redirect("/admin/seo?message=saved");
    } catch (error) {
        console.error("postSeoPage error:", error);
        return res.redirect("/admin/seo?message=error");
    }
};
