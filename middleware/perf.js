/* Lightweight response-time tracker for the admin Speed page.

   Keeps a small in-memory ring of recent HTML responses and per-route
   averages. No external dependency and negligible overhead: one high
   resolution timestamp per request and a push on finish. */

const MAX_RECENT = 300;

const recent = [];
const routes = new Map();

function routeKey(req) {
    if (req.route && req.route.path) {
        return (req.baseUrl || "") + req.route.path;
    }
    return req.path || "/";
}

function pushRecent(entry) {
    recent.push(entry);
    if (recent.length > MAX_RECENT) recent.shift();
}

module.exports = function perf(req, res, next) {
    if (req.method !== "GET") return next();

    const start = process.hrtime.bigint();

    res.on("finish", function () {
        const type = String(res.getHeader("Content-Type") || "");
        if (type.indexOf("text/html") === -1) return;

        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        const key = routeKey(req);

        let row = routes.get(key);
        if (!row) {
            row = { route: key, count: 0, total: 0, max: 0, last: 0, samples: [] };
            routes.set(key, row);
        }

        row.count += 1;
        row.total += ms;
        row.last = ms;
        if (ms > row.max) row.max = ms;

        row.samples.push(ms);
        if (row.samples.length > 100) row.samples.shift();

        pushRecent({
            at: new Date(),
            route: key,
            status: res.statusCode,
            ms: Math.round(ms)
        });
    });

    next();
};

module.exports.snapshot = function () {
    const list = [];

    routes.forEach(function (row) {
        const sorted = row.samples.slice().sort(function (a, b) { return a - b; });
        const p95 = sorted.length
            ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
            : 0;

        list.push({
            route: row.route,
            count: row.count,
            avg: Math.round(row.total / row.count),
            last: Math.round(row.last),
            max: Math.round(row.max),
            p95: Math.round(p95)
        });
    });

    list.sort(function (a, b) { return b.avg - a.avg; });

    return {
        routes: list,
        recent: recent.slice().reverse()
    };
};
