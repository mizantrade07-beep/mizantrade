/* In-memory TTL cache for expensive, rarely-changing reads.

   The storefront used to hit MongoDB for categories, footer content, footer
   pages and every homepage product section on every single request. Those
   values change only when an admin saves something, so they are cached per
   process and invalidated from the admin controllers on save/delete.

   Keep TTLs short (30-120s) so multi-worker deployments still converge
   quickly even if another worker invalidates first. */

const store = new Map();
const pending = new Map();

let hits = 0;
let misses = 0;
let sets = 0;

function now() {
    return Date.now();
}

function get(key) {
    const entry = store.get(key);

    if (!entry) {
        misses += 1;
        return undefined;
    }

    if (entry.expiresAt && entry.expiresAt <= now()) {
        store.delete(key);
        misses += 1;
        return undefined;
    }

    hits += 1;
    return entry.value;
}

function set(key, value, ttlMs) {
    sets += 1;
    store.set(key, {
        value: value,
        savedAt: now(),
        expiresAt: ttlMs > 0 ? now() + ttlMs : 0
    });
    return value;
}

function del(key) {
    store.delete(key);
}

function delPrefix(prefix) {
    store.forEach(function (_entry, key) {
        if (key.indexOf(prefix) === 0) store.delete(key);
    });
}

function clear() {
    store.clear();
    pending.clear();
    hits = 0;
    misses = 0;
    sets = 0;
}

/* Read-through helper: returns the cached value or runs loader once.
   Concurrent misses for the same key share one loader promise, so a cold
   cache never fires the same six queries from ten requests at once. */
async function wrap(key, ttlMs, loader) {
    const cached = get(key);
    if (cached !== undefined) return cached;

    if (pending.has(key)) return pending.get(key);

    const promise = (async function () {
        try {
            const value = await loader();
            return set(key, value, ttlMs);
        } finally {
            pending.delete(key);
        }
    })();

    pending.set(key, promise);
    return promise;
}

function stats() {
    const entries = [];

    store.forEach(function (entry, key) {
        entries.push({
            key: key,
            ageMs: now() - entry.savedAt,
            remainingMs: entry.expiresAt ? Math.max(0, entry.expiresAt - now()) : 0
        });
    });

    entries.sort(function (a, b) { return a.key.localeCompare(b.key); });

    const total = hits + misses;

    return {
        size: store.size,
        hits: hits,
        misses: misses,
        sets: sets,
        hitRate: total ? Math.round((hits / total) * 1000) / 10 : 0,
        entries: entries
    };
}

module.exports = {
    get: get,
    set: set,
    del: del,
    delPrefix: delPrefix,
    clear: clear,
    wrap: wrap,
    stats: stats
};
