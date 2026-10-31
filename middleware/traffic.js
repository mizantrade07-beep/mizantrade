const TrafficDaily = require("../models/TrafficDaily");
const TrafficVisitor = require("../models/TrafficVisitor");

const SKIP = /^\/(admin|api|uploads|images|css|js|fonts|favicon|health)/i;
const BOT = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|preview/i;
const ORGANIC = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask|aol)\./i;
const SOCIAL = /(^|\.)(facebook|instagram|tiktok|linkedin|twitter|x|pinterest|reddit|youtube)\./i;

function dayKey(date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);
}

function hostOf(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return "";
    }
}

function sourceOf(req) {
    const ref = hostOf(req.get("referer") || "");
    if (!ref) return "direct";

    const self = hostOf("http://" + (req.get("host") || "localhost"));
    if (ref === self) return "direct";

    if (ORGANIC.test(ref)) return "organic";
    if (SOCIAL.test(ref)) return "social";
    return "referral";
}

function record(req, res) {
    if (res.statusCode !== 200) return;

    const now = new Date();
    const day = dayKey(now);
    const source = sourceOf(req);
    const inc = { views: 1 };
    if (source === "organic") inc.organic = 1;
    if (source === "social") inc.social = 1;
    if (source === "referral") inc.referral = 1;

    TrafficDaily.updateOne(
        { day },
        { $inc: inc },
        { upsert: true }
    ).catch(function () {});

    const visitor = require("crypto")
        .createHash("sha256")
        .update(String(req.sessionID || "") + "|" + day)
        .digest("hex")
        .slice(0, 32);

    TrafficVisitor.updateOne(
        { day, visitor },
        { $set: { lastSeen: now } },
        { upsert: true }
    ).then(function (result) {
        if (result && result.upsertedCount) {
            return TrafficDaily.updateOne({ day }, { $inc: { visitors: 1 } });
        }
    }).catch(function () {});
}

module.exports = function traffic(req, res, next) {
    if (req.method !== "GET") return next();
    if (req.query.speedcheck) return next();
    if (SKIP.test(req.path)) return next();
    if (!req.accepts("html")) return next();
    if (BOT.test(req.get("user-agent") || "")) return next();

    res.on("finish", function () {
        record(req, res);
    });

    next();
};
