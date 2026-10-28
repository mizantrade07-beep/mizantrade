const mongoose = require("mongoose");
const Product = require("../models/Product");

const MAX_COMPARE = 4;

const NON_COMPARABLE_KEY =
    /(model|sku|part\s*(?:no|number)|interface|form\s*factor|factor|color|series|type|compatib|dimension)/i;
const LOWER_IS_BETTER = /(weight|latency|response\s*time|response|thickness)/i;
const VERSION_KEY = /(version|generation|pcie|usb|ddr|bluetooth|wi-?fi|hdmi|displayport)/i;

const UNIT_TABLE = {
    kb: { family: "data", factor: 1 / 1024 },
    mb: { family: "data", factor: 1 },
    gb: { family: "data", factor: 1024 },
    tb: { family: "data", factor: 1024 * 1024 },
    hz: { family: "frequency", factor: 1 },
    khz: { family: "frequency", factor: 1e3 },
    mhz: { family: "frequency", factor: 1e6 },
    ghz: { family: "frequency", factor: 1e9 },
    mm: { family: "length", factor: 1 },
    cm: { family: "length", factor: 10 },
    inch: { family: "length", factor: 25.4 },
    in: { family: "length", factor: 25.4 },
    '"': { family: "length", factor: 25.4 },
    w: { family: "power", factor: 1 },
    watt: { family: "power", factor: 1 },
    watts: { family: "power", factor: 1 },
    wh: { family: "energy", factor: 1 },
    kwh: { family: "energy", factor: 1000 },
    mah: { family: "battery", factor: 1 },
    ah: { family: "battery", factor: 1000 },
    "%": { family: "percent", factor: 1 },
    year: { family: "duration", factor: 1 },
    years: { family: "duration", factor: 1 },
    yr: { family: "duration", factor: 1 },
    yrs: { family: "duration", factor: 1 },
    month: { family: "duration", factor: 1 / 12 },
    months: { family: "duration", factor: 1 / 12 }
};

function htmlToText(html) {
    return String(html || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/(li|p|div|tr|h[1-6])>/gi, " | ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#0*39;|&apos;/gi, "'")
        .replace(/\s+/g, " ")
        .replace(/^(\s*\|\s*)+|(\s*\|\s*)+$/g, "")
        .trim();
}

function parseLiSpecs(html) {
    const items = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;

    while ((match = liPattern.exec(String(html || ""))) !== null) {
        const text = htmlToText(match[1]);
        if (!text) continue;

        text.split(/,\s*(?=[A-Za-z][A-Za-z0-9 /()#.+%-]{0,30}\s*:)/).forEach((part) => {
            const colon = part.indexOf(":");
            if (colon < 1) return;
            const key = part.slice(0, colon).trim();
            const value = part.slice(colon + 1).trim();
            if (key && value && key.length <= 40) items.push({ key, value });
        });
    }

    return items;
}

function parseShortSpecs(html) {
    const items = parseLiSpecs(html);

    if (!items.length) {
        const pattern = /([A-Za-z][A-Za-z0-9 /()#.+%-]{0,30})\s*:\s*([^:|]+)/g;
        let plainMatch;
        const plain = htmlToText(html);
        while ((plainMatch = pattern.exec(plain)) !== null) {
            const key = plainMatch[1].trim();
            const value = plainMatch[2].trim();
            if (key && value) items.push({ key, value });
        }
    }

    return items;
}

// Admin spec sheets mostly live in longDesc as <table><tr><td>Label</td><td>Value</td></tr>...
function parseTableSpecs(html) {
    const items = [];
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(String(html || ""))) !== null) {
        const cells = [];
        const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cellMatch;

        while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
            cells.push(htmlToText(cellMatch[1]));
        }

        for (let i = 0; i + 1 < cells.length; i += 2) {
            const key = cells[i].replace(/[:：]\s*$/, "").trim();
            const value = cells[i + 1].trim();
            if (!key || !value) continue;
            if (key.length > 30 || value.length > 80) continue;
            if (/[.!?]\s*$/.test(value) || /\.\s+[A-Z]/.test(value)) continue;
            if (/^(?:key features|up to|with|features?|delivers?|provides?|offers?|supports?|enjoy|experience|designed|built)\b/i.test(key)) continue;
            items.push({ key, value });
        }
    }

    return items;
}

function canonicalSpec(key) {
    const label = String(key || "").replace(/\s+/g, " ").trim();
    const lower = label.toLowerCase();

    if (/^(?:max(?:imum)?\.?\s*)?(?:sequential\s+)?read(?:\s+speed)?$/.test(lower)) {
        return { id: "read speed", label: "Read Speed" };
    }
    if (/^(?:max(?:imum)?\.?\s*)?(?:sequential\s+)?write(?:\s+speed)?$/.test(lower)) {
        return { id: "write speed", label: "Write Speed" };
    }
    if (lower === "capacity" || lower === "storage" || lower === "user capacity") {
        return { id: "capacity", label: "Capacity" };
    }
    if (/^(?:tbw|endurance)(?:\s*\(.*\))?$/.test(lower)) {
        return { id: "endurance", label: "Endurance (TBW)" };
    }
    if (/^mtbf(?:\s*\(.*\))?$/.test(lower)) {
        return { id: "mtbf", label: "MTBF" };
    }
    if (/^warranty(?:\s*(?:period|duration))?$/.test(lower)) {
        return { id: "warranty", label: "Warranty" };
    }
    if (/^(?:nand\s*flash|flash\s*(?:type|memory)?)$/.test(lower)) {
        return { id: "flash type", label: "NAND Flash" };
    }
    if (/^(?:operating|input)\s*voltage$/.test(lower)) {
        return { id: "voltage", label: "Operating Voltage" };
    }
    if (/^operating\s*temperature$/.test(lower)) {
        return { id: "operating temperature", label: "Operating Temperature" };
    }
    if (/^storage\s*temperature$/.test(lower)) {
        return { id: "storage temperature", label: "Storage Temperature" };
    }
    if (/^(?:origin|country\s*of\s*origin)$/.test(lower)) {
        return { id: "origin", label: "Origin" };
    }
    if (/^model(?:\s*(?:name|number|no\.?|code))?$/.test(lower)) {
        return { id: "model", label: "Model" };
    }
    return { id: lower, label };
}

function specsFor(product) {
    const map = new Map();

    const add = (key, value) => {
        const canonical = canonicalSpec(key);
        if (!canonical.id || canonical.id === "brand") return;
        if (!map.has(canonical.id)) {
            map.set(canonical.id, { key: canonical.label, value: String(value).trim() });
        }
    };

    (product.specs || []).forEach((spec) => {
        if (!spec || !spec.key || !spec.value) return;
        add(spec.key, spec.value);
    });

    parseTableSpecs(product.longDesc).forEach((spec) => add(spec.key, spec.value));
    parseLiSpecs(product.longDesc).forEach((spec) => add(spec.key, spec.value));
    parseShortSpecs(product.shortDesc).forEach((spec) => add(spec.key, spec.value));

    return map;
}

function parseQuantity(value) {
    const text = String(value || "").replace(/,/g, "");
    const match = text.match(/(\d+(?:\.\d+)?)\s*[-\s]?\s*(tb|gb|mb|kb|ghz|mhz|khz|hz|kwh|wh|mah|ah|years?|yrs?|months?|mm|cm|inch|in|watt|watts|w|%|")/i);
    if (!match) return null;
    const unit = UNIT_TABLE[match[2].toLowerCase()];
    if (!unit) return null;
    return { family: unit.family, value: parseFloat(match[1]) * unit.factor };
}

function parseVersion(value) {
    const text = String(value || "");
    const patterns = [
        /ddr\s*(\d+)/i,
        /pcie\s*(\d+(?:\.\d+)?)/i,
        /usb\s*(\d+(?:\.\d+)?)/i,
        /bluetooth\s*(\d+(?:\.\d+)?)/i,
        /wi-?fi\s*(\d+(?:\.\d+)?)/i,
        /hdmi\s*(\d+(?:\.\d+)?)/i,
        /displayport\s*(\d+(?:\.\d+)?)/i,
        /gen(?:eration)?\s*(\d+(?:\.\d+)?)/i
    ];

    for (let i = 0; i < patterns.length; i++) {
        const match = text.match(patterns[i]);
        if (match) return parseFloat(match[1]);
    }

    return null;
}

function bestIndexes(values, label) {
    if (NON_COMPARABLE_KEY.test(label)) return [];

    const quantities = values.map(parseQuantity);
    const numeric = quantities.filter(Boolean);

    if (numeric.length >= 2 && numeric.every((q) => q.family === numeric[0].family)) {
        const target = LOWER_IS_BETTER.test(label)
            ? Math.min(...numeric.map((q) => q.value))
            : Math.max(...numeric.map((q) => q.value));
        const winners = [];

        quantities.forEach((q, index) => {
            if (q && Math.abs(q.value - target) < 1e-9) winners.push(index);
        });

        return winners.length < numeric.length ? winners : [];
    }

    if (VERSION_KEY.test(label)) {
        const versions = values.map((v) => (v ? parseVersion(v) : null));
        const numericVersions = versions.filter((v) => v !== null);

        if (numericVersions.length >= 2) {
            const max = Math.max(...numericVersions);
            const winners = [];

            versions.forEach((v, index) => {
                if (v !== null && Math.abs(v - max) < 1e-9) winners.push(index);
            });

            if (winners.length < numericVersions.length) return winners;
        }
    }

    return [];
}

function priceOf(product) {
    if (product.callForPrice) return null;
    return product.salePrice || product.regularPrice || null;
}

function ratingOf(product) {
    const reviews = (product.reviews || []).filter((review) => review && review.isApproved);
    if (!reviews.length) return { text: "No reviews yet", value: 0 };

    const average = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length;
    return { text: "★ " + average.toFixed(1) + " (" + reviews.length + ")", value: average };
}

function titleCapacity(product) {
    const title = String(product.title || "");
    const pattern = /(\d+(?:\.\d+)?)\s*(TB|GB)\b/gi;
    const matches = [];
    let match;

    while ((match = pattern.exec(title)) !== null) {
        const after = title.slice(match.index + match[0].length, match.index + match[0].length + 14);
        if (/^\s*(ram|ddr|memory)\b/i.test(after)) continue;
        matches.push({
            gb: /tb/i.test(match[2]) ? parseFloat(match[1]) * 1024 : parseFloat(match[1]),
            label: match[1] + " " + match[2].toUpperCase()
        });
    }

    if (!matches.length) return "";
    matches.sort((a, b) => b.gb - a.gb);
    return matches[0].label;
}

function titleRam(product) {
    const title = String(product.title || "");
    const match =
        title.match(/(\d+)\s*GB\s*(?:DDR\d?\s*)?RAM\b/i) ||
        title.match(/\bRAM[:\s]*(\d+)\s*GB\b/i);
    return match ? match[1] + " GB" : "";
}

function stockScore(status) {
    if (status === "In Stock") return 3;
    if (status === "Pre Order") return 2;
    if (status === "Coming Soon") return 1;
    return 0;
}

function specWeight(label) {
    const text = String(label || "");
    if (/(read|write|speed|iops|rpm|clock|frequency|refresh)/i.test(text)) return 5;
    if (/(capacity|storage|memory)/i.test(text)) return 4;
    if (/(tbw|endurance|durab)/i.test(text)) return 4;
    if (/warranty/i.test(text)) return 3;
    if (/(mtbf|reliab)/i.test(text)) return 2;
    return 1;
}

function specRank(label) {
    const text = String(label || "");
    if (/(read|write|speed|iops|rpm|clock|frequency|refresh)/i.test(text)) return 10;
    if (/(capacity|storage|memory)/i.test(text)) return 20;
    if (/(tbw|endurance|durab)/i.test(text)) return 30;
    if (/warranty/i.test(text)) return 40;
    if (/(mtbf|reliab)/i.test(text)) return 50;
    if (/interface/i.test(text)) return 60;
    if (/form\s*factor/i.test(text)) return 70;
    if (/model/i.test(text)) return 80;
    if (/(voltage|temperature)/i.test(text)) return 90;
    return 100;
}

function compactValue(value) {
    return String(value || "")
        .replace(/\(\s*max\.?\s*\)/gi, "")
        .replace(/^max(?:imum)?\.?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function parseYears(value) {
    const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*[-\s]?\s*(?:years?|yrs?)/i);
    return match ? match[1] : "";
}

function buildSpecReasons(rows, index) {
    const wins = rows
        .filter((row) => row.best.indexOf(index) >= 0)
        .sort((a, b) => specWeight(b.label) - specWeight(a.label));
    const reasons = [];

    for (let i = 0; i < wins.length && reasons.length < 3; i++) {
        const row = wins[i];
        // অন্য প্রোডাক্টের সঙ্গে সমান হলে সেটি "বেশি/দ্রুত" হিসেবে দেখানো যায় না
        if (row.best.length !== 1) continue;
        const otherIndex = row.values.findIndex(
            (value, position) => position !== index && value && row.best.indexOf(position) < 0
        );
        if (otherIndex < 0) continue;

        const mine = compactValue(row.values[index]);
        const other = compactValue(row.values[otherIndex]);
        const label = row.label.toLowerCase();

        if (/warranty/.test(label)) {
            const mineYears = parseYears(row.values[index]);
            const otherYears = parseYears(row.values[otherIndex]);
            reasons.push(
                "Longer warranty (" +
                (mineYears ? mineYears + " years" : mine) + " vs " +
                (otherYears ? otherYears + " years" : other) + ")"
            );
        } else if (/(read|write|speed)/.test(label)) {
            reasons.push("Faster " + label + " (" + mine + " vs " + other + ")");
        } else if (/(capacity|storage|memory)/.test(label)) {
            reasons.push("More storage (" + mine + " vs " + other + ")");
        } else if (/(tbw|endurance)/.test(label)) {
            reasons.push("Higher endurance (" + mine + " vs " + other + ")");
        } else {
            reasons.push("Better " + label + " (" + mine + " vs " + other + ")");
        }
    }

    return reasons;
}

function pickRecommended(products, specRows, priceInfo) {
    if (products.length < 2) return { index: -1, reasons: [], basis: "" };

    const scores = products.map(() => 0);
    specRows.forEach((row) => {
        const weight = specWeight(row.label);
        row.best.forEach((index) => { scores[index] += weight; });
    });

    const maxScore = Math.max(...scores);
    const specBasis = maxScore > 0;
    let pool = scores
        .map((score, index) => (!specBasis || score === maxScore ? index : -1))
        .filter((index) => index >= 0);

    if (pool.length > 1) {
        const topStock = Math.max(...pool.map((index) => stockScore(products[index].stockStatus)));
        pool = pool.filter((index) => stockScore(products[index].stockStatus) === topStock);
    }

    if (pool.length > 1) {
        const priced = pool.filter((index) => priceInfo[index].value !== null);
        if (priced.length === pool.length) {
            const minPrice = Math.min(...priced.map((index) => priceInfo[index].value));
            const cheapest = priced.filter((index) => priceInfo[index].value === minPrice);
            if (cheapest.length < pool.length) pool = cheapest;
        }
    }

    if (pool.length > 1) {
        const ratings = pool.map((index) => ratingOf(products[index]).value);
        const topRating = Math.max(...ratings);
        if (topRating > 0) {
            const rated = pool.filter((index, position) => ratings[position] === topRating);
            if (rated.length < pool.length) pool = rated;
        }
    }

    if (pool.length !== 1) return { index: -1, reasons: [], basis: specBasis ? "specs" : "" };

    const index = pool[0];
    const reasons = specBasis ? buildSpecReasons(specRows, index) : [];

    if (
        reasons.length < 3 &&
        products[index].stockStatus === "In Stock" &&
        products.some((product, position) => position !== index && product.stockStatus !== "In Stock")
    ) {
        reasons.push("In stock now");
    }

    if (reasons.length < 3 && priceInfo[index].value !== null) {
        const priceValues = priceInfo.map((info) => info.value);
        const pricedCount = priceValues.filter((value) => value !== null).length;
        const minPrice = Math.min(...priceValues.filter((value) => value !== null));
        if (
            pricedCount === products.length &&
            priceInfo[index].value === minPrice &&
            priceValues.filter((value) => value === minPrice).length === 1
        ) {
            reasons.push("Lowest price");
        }
    }

    if (reasons.length === 0) {
        if (specBasis) {
            const winCount = specRows.filter((row) => row.best.indexOf(index) >= 0).length;
            reasons.push(
                "Best overall specifications" +
                (winCount ? " (" + winCount + " key spec" + (winCount > 1 ? "s" : "") + ")" : "")
            );
        } else if (ratingOf(products[index]).value > 0) {
            reasons.push("Highest customer rating");
        } else {
            reasons.push("Best available option");
        }
    }

    return { index, reasons: reasons.slice(0, 3), basis: specBasis ? "specs" : "value" };
}

function wantsJson(req) {
    return Boolean(
        req.headers.accept &&
        req.headers.accept.includes("application/json")
    ) || req.xhr;
}

function getCompareIds(req) {
    if (!Array.isArray(req.session.compare)) {
        req.session.compare = [];
    }
    return req.session.compare;
}

exports.getCompare = async (req, res) => {
    const ids = getCompareIds(req).map(String);

    let products = [];

    if (ids.length) {
        const docs = await Product.find({
            _id: { $in: ids },
            isActive: true
        }).lean();

        const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
        products = ids.map((id) => byId.get(id)).filter(Boolean);

        // session-এ থাকা কিন্তু inactive/ডিলিট হওয়া আইডি বাদ
        if (products.length !== ids.length) {
            req.session.compare = products.map((p) => String(p._id));
        }
    }

    // specs[] + shortDesc-এর ভেতরের লেবেল:ভ্যালু লিস্ট — দুটো মিলিয়ে পূর্ণ স্পেসিফিকেশন
    const specMaps = products.map((product) => specsFor(product));
    const keyOrder = [];
    const keyLabels = new Map();

    specMaps.forEach((map) => {
        map.forEach((spec, id) => {
            if (!keyLabels.has(id)) {
                keyLabels.set(id, spec.key);
                keyOrder.push(id);
            }
        });
    });

    const specRows = keyOrder.map((id) => {
        const label = keyLabels.get(id);
        const values = specMaps.map((map) => {
            const spec = map.get(id);
            return spec ? spec.value : "";
        });
        return { label, values, best: bestIndexes(values, label) };
    });

    const hasSpecKey = (pattern) => keyOrder.some((id) => pattern.test(keyLabels.get(id)));
    const autoRows = [];

    if (!hasSpecKey(/capacity|storage/i)) {
        const values = products.map(titleCapacity);
        if (values.some(Boolean)) {
            autoRows.push({ label: "Storage", values, best: bestIndexes(values, "Storage") });
        }
    }

    if (!hasSpecKey(/(^|\b)(ram|memory)(\b|$)/i)) {
        const values = products.map(titleRam);
        if (values.some(Boolean)) {
            autoRows.push({ label: "Memory (RAM)", values, best: bestIndexes(values, "Memory (RAM)") });
        }
    }

    const priceInfo = products.map((product) => {
        const value = priceOf(product);
        const regular = Number(product.regularPrice) || 0;
        const discount =
            !product.callForPrice && product.salePrice && regular > product.salePrice
                ? Math.round((1 - product.salePrice / regular) * 100)
                : 0;
        return { value, regular, discount };
    });

    // যে স্পেসিফিকেশন সব প্রোডাক্টে নেই সেটি রো হিসেবে দেখাই না — ফাঁকা "—" সেল থাকে না
    const compareRows = autoRows
        .concat(specRows)
        .filter((row) => (products.length > 1 ? row.values.every(Boolean) : row.values.some(Boolean)))
        .sort((a, b) => specRank(a.label) - specRank(b.label));

    const productMeta = products.map((product) => {
        const rating = ratingOf(product);
        return {
            stock: product.stockStatus || "",
            tone:
                product.stockStatus === "In Stock"
                    ? "ok"
                    : product.stockStatus === "Out of Stock"
                        ? "bad"
                        : "soon",
            brand: product.brand || "",
            rating: rating.value > 0 ? rating.text : ""
        };
    });

    const recommendation = pickRecommended(products, compareRows, priceInfo);

    res.render("compare", {
        pageTitle: "Compare Products",
        products,
        productMeta,
        specRows: compareRows,
        priceInfo,
        recommendation,
        maxCompare: MAX_COMPARE,
        full: req.query.full === "1"
    });
};

exports.addToCompare = async (req, res) => {
    const productId = String(req.body.productId || req.params.id || "");
    const ids = getCompareIds(req);

    if (!mongoose.isValidObjectId(productId)) {
        if (wantsJson(req)) {
            return res.status(400).json({ success: false, message: "Invalid product." });
        }
        return res.redirect("/compare");
    }

    if (ids.includes(productId)) {
        if (wantsJson(req)) {
            return res.json({
                success: true,
                already: true,
                message: "This product is already in your compare list.",
                compareCount: ids.length
            });
        }
        return res.redirect("/compare");
    }

    if (ids.length >= MAX_COMPARE) {
        if (wantsJson(req)) {
            return res.json({
                success: false,
                full: true,
                message: "You can compare up to " + MAX_COMPARE + " products. Remove one first.",
                compareCount: ids.length
            });
        }
        return res.redirect("/compare?full=1");
    }

    const exists = await Product.exists({ _id: productId, isActive: true });

    if (!exists) {
        if (wantsJson(req)) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }
        return res.redirect("/compare");
    }

    ids.push(productId);

    if (wantsJson(req)) {
        return res.json({
            success: true,
            message: "Added to compare (" + ids.length + "/" + MAX_COMPARE + ").",
            compareCount: ids.length
        });
    }

    return res.redirect("/compare");
};

exports.removeFromCompare = (req, res) => {
    const productId = String(req.body.productId || req.params.id || "");

    req.session.compare = getCompareIds(req).filter(
        (id) => String(id) !== productId
    );

    if (wantsJson(req)) {
        return res.json({ success: true, compareCount: req.session.compare.length });
    }

    return res.redirect("/compare");
};

exports.clearCompare = (req, res) => {
    req.session.compare = [];

    if (wantsJson(req)) {
        return res.json({ success: true, compareCount: 0 });
    }

    return res.redirect("/compare");
};
