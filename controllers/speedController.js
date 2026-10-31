/* Admin → Speed & Performance.

   Collects real numbers from the running process (DB latency, cache hit
   rate, per-route render times) and can request the live homepage through
   the same Apache/Passenger stack a visitor uses, reporting TTFB, transfer
   size, compression and static cache headers. */

const http = require("http");
const https = require("https");
const { URL } = require("url");
const mongoose = require("mongoose");

const config = require("../config/env");
const cache = require("../utils/cache");
const perf = require("../middleware/perf");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Page = require("../models/Page");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36";

let lastCheck = null;

function msSince(start) {
    return Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10;
}

function timed(fn) {
    const start = process.hrtime.bigint();

    return Promise.resolve()
        .then(fn)
        .then(function (value) {
            return { ms: msSince(start), value: value, error: null };
        })
        .catch(function (error) {
            return { ms: msSince(start), value: null, error: error.message };
        });
}

function fetchOnce(url, headers) {
    return new Promise(function (resolve) {
        const target = new URL(url);
        const lib = target.protocol === "https:" ? https : http;
        const started = process.hrtime.bigint();

        const request = lib.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port || undefined,
            path: target.pathname + target.search,
            method: "GET",
            headers: Object.assign({
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }, headers || {}),
            timeout: 20000
        }, function (response) {
            let bytes = 0;
            let ttfb = null;

            response.on("data", function (chunk) {
                if (ttfb === null) ttfb = msSince(started);
                bytes += chunk.length;
            });

            response.on("end", function () {
                resolve({
                    ok: true,
                    status: response.statusCode,
                    ttfb: ttfb === null ? msSince(started) : ttfb,
                    total: msSince(started),
                    bytes: bytes,
                    headers: response.headers
                });
            });
        });

        request.on("timeout", function () {
            request.destroy(new Error("Request timed out after 20s"));
        });

        request.on("error", function (error) {
            resolve({
                ok: false,
                status: 0,
                ttfb: 0,
                total: msSince(started),
                bytes: 0,
                headers: {},
                error: error.message
            });
        });

        request.end();
    });
}

function maxAgeSeconds(cacheControl) {
    const match = /max-age=(\d+)/i.exec(String(cacheControl || ""));
    return match ? Number(match[1]) : 0;
}

async function collectSystem() {
    const memory = process.memoryUsage();

    return {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
        pid: process.pid,
        env: config.nodeEnv,
        rssMb: Math.round(memory.rss / 1048576),
        heapUsedMb: Math.round(memory.heapUsed / 1048576),
        heapTotalMb: Math.round(memory.heapTotal / 1048576),
        mongoReadyState: mongoose.connection.readyState
    };
}

async function collectDatabase() {
    const ping = await timed(function () {
        if (mongoose.connection.readyState !== 1) {
            throw new Error("MongoDB is not connected");
        }
        return mongoose.connection.db.admin().command({ ping: 1 });
    });

    const counts = await timed(async function () {
        const [products, activeProducts, categories, pages] = await Promise.all([
            Product.estimatedDocumentCount(),
            Product.countDocuments({ isActive: true }),
            Category.countDocuments({}),
            Page.countDocuments({ status: "published" })
        ]);

        return { products, activeProducts, categories, pages };
    });

    const indexes = await timed(async function () {
        const [category, product] = await Promise.all([
            Category.collection.indexes(),
            Product.collection.indexes()
        ]);

        return {
            category: category.map(function (i) { return i.name; }),
            product: product.map(function (i) { return i.name; })
        };
    });

    return {
        connected: mongoose.connection.readyState === 1,
        pingMs: ping.ms,
        pingError: ping.error,
        counts: counts.value || { products: 0, activeProducts: 0, categories: 0, pages: 0 },
        countsError: counts.error,
        indexes: indexes.value || { category: [], product: [] },
        indexesError: indexes.error
    };
}

async function runSiteCheck() {
    const base = String(config.siteUrl || "http://localhost:5000").replace(/\/+$/, "");

    const compressed = await fetchOnce(base + "/?speedcheck=1", {
        "Accept-Encoding": "br, gzip"
    });

    const raw = await fetchOnce(base + "/?speedcheck=1", {
        "Accept-Encoding": "identity"
    });

    const css = await fetchOnce(base + "/css/style.css", {
        "Accept-Encoding": "identity"
    });

    const encoding = String(compressed.headers["content-encoding"] || "");
    const ratio = raw.bytes && compressed.bytes
        ? Math.round((1 - compressed.bytes / raw.bytes) * 1000) / 10
        : 0;

    return {
        at: new Date(),
        base: base,
        home: compressed,
        raw: raw,
        css: css,
        encoding: encoding,
        compressedBytes: compressed.bytes,
        rawBytes: raw.bytes,
        ratio: ratio,
        cssCacheControl: String(css.headers["cache-control"] || ""),
        cssMaxAgeDays: Math.round(maxAgeSeconds(css.headers["cache-control"]) / 864) / 100
    };
}

function buildChecks(store, site, db) {
    const checks = [];

    function add(label, status, value, hint) {
        checks.push({ label: label, status: status, value: value, hint: hint || "" });
    }

    const compressed = !!(site && site.encoding);

    add(
        "Brotli / gzip compression",
        compressed ? "pass" : "fail",
        site ? (site.encoding || "none") : "not checked",
        "HTML must be compressed before it leaves the server."
    );

    if (site) {
        const ttfb = site.home.ttfb;
        add(
            "Homepage TTFB",
            ttfb < 800 ? "pass" : ttfb < 2000 ? "warn" : "fail",
            ttfb + " ms",
            "Above 800 ms means the server is spending too long building HTML."
        );

        add(
            "Homepage total",
            site.home.total < 1500 ? "pass" : site.home.total < 3000 ? "warn" : "fail",
            site.home.total + " ms",
            "Target is under 1.5s for the HTML response itself."
        );

        const days = maxAgeSeconds(site.cssCacheControl) / 86400;
        add(
            "Static file caching",
            days >= 7 ? "pass" : days >= 1 ? "warn" : "fail",
            days ? days.toFixed(1) + " days" : "no max-age",
            "CSS/JS must be cached with a long max-age."
        );

        add(
            "Compression ratio",
            site.ratio >= 60 ? "pass" : site.ratio >= 35 ? "warn" : "fail",
            site.ratio + "% saved",
            "Typical HTML compresses by 80%+."
        );
    }

    if (db) {
        add(
            "MongoDB ping",
            db.pingMs < 100 ? "pass" : db.pingMs < 250 ? "warn" : "fail",
            db.pingMs + " ms",
            "High ping means the app and database are far apart."
        );

        add(
            "Category indexes",
            (db.indexes.category || []).length >= 3 ? "pass" : "warn",
            (db.indexes.category || []).length + " indexes",
            "Category reads need isActive/order and parent indexes."
        );

        add(
            "Product sort index",
            (db.indexes.product || []).some(function (name) {
                return /stockRank/i.test(name) && /isActive/i.test(name);
            }) ? "pass" : "warn",
            (db.indexes.product || []).length + " indexes",
            "Homepage sections sort active products by stockRank/createdAt."
        );
    }

    add(
        "Data cache",
        store.hitRate >= 50 ? "pass" : store.size > 0 ? "warn" : "fail",
        store.hitRate + "% hit rate",
        "Categories, footer and homepage sections are cached in memory."
    );

    return checks;
}

function scoreChecks(checks) {
    if (!checks.length) return 0;

    let score = 0;
    checks.forEach(function (c) {
        if (c.status === "pass") score += 100 / checks.length;
        else if (c.status === "warn") score += 50 / checks.length;
    });

    return Math.round(score);
}

function grade(score) {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "E";
}

function recommendations(checks) {
    return checks
        .filter(function (c) { return c.status !== "pass" && c.hint; })
        .map(function (c) { return c.hint; });
}

/* ======================================================
   ADMIN - SPEED PAGE (GET)
====================================================== */

exports.getSpeed = async function (req, res) {
    try {
        const wantCheck = req.query.check === "1";

        const [system, db, site] = await Promise.all([
            collectSystem(),
            collectDatabase(),
            wantCheck ? runSiteCheck() : Promise.resolve(null)
        ]);

        if (site) lastCheck = site;

        const store = cache.stats();
        const perfSnapshot = perf.snapshot();
        const reportSite = site || lastCheck;
        const checks = buildChecks(store, reportSite, db);
        const score = scoreChecks(checks);

        return res.render("admin/speed", {
            pageTitle: "Speed & Performance",
            system: system,
            db: db,
            cache: store,
            perf: perfSnapshot,
            site: reportSite,
            siteIsLive: !!site,
            checks: checks,
            score: score,
            grade: grade(score),
            tips: recommendations(checks),
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getSpeed error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - CLEAR CACHE (POST)
====================================================== */

exports.postClearCache = function (req, res) {
    cache.clear();
    return res.redirect("/admin/speed?message=cleared");
};
