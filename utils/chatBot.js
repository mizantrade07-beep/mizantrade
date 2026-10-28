const Product = require("../models/Product");
const Category = require("../models/Category");
const Faq = require("../models/Faq");
const siteConfig = require("../config/site");
const { isAiConfigured, askAi } = require("./aiChat");

/* ======================================================
   WEBSITE KNOWLEDGE
   Products, categories, brands, FAQs and live site settings
   are cached for one minute and used to answer visitors.
====================================================== */

const CACHE_MS = 60 * 1000;

let knowledge = {
    at: 0,
    products: [],
    categories: [],
    faqs: [],
    brands: []
};

let loading = null;

function escapeRe(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asciiDigits(value) {
    const bn = "০১২৩৪৫৬৭৮৯";
    return String(value || "").replace(/[০-৯]/g, function (d) {
        return String(bn.indexOf(d));
    });
}

function stripHtml(html) {
    return String(html || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}

/* Bengali / Banglish words → the English words used in the catalogue. */
const BN_REPLACEMENTS = [
    [/কত\s*দিনে?/g, " how many days "],
    [/প্রি\s*অর্ডার/g, " pre order "],
    [/ইন\s*স্টক/g, " in stock "],
    [/আউট\s*অফ\s*স্টক/g, " out of stock "],
    [/র্যাম|রাম/g, " ram "],
    [/হার্ড\s*ডিস্ক|হার্ডডিস্ক/g, " hdd "],
    [/সলিড\s*স্টেট\s*ড্রাইভ/g, " ssd "],
    [/এসএসডি/g, " ssd "],
    [/এনভিএমই/g, " nvme "],
    [/মাদারবোর্ড/g, " motherboard "],
    [/প্রসেসর/g, " processor "],
    [/গ্রাফিক্স\s*কার্ড/g, " graphics card "],
    [/কেসিং/g, " casing "],
    [/পাওয়ার\s*সাপ্লাই/g, " power supply "],
    [/মনিটর/g, " monitor "],
    [/কিবোর্ড/g, " keyboard "],
    [/মাউস/g, " mouse "],
    [/ল্যাপটপ/g, " laptop "],
    [/প্রিন্টার/g, " printer "],
    [/রাউটার/g, " router "],
    [/ওয়েবক্যাম/g, " webcam "],
    [/পেনড্রাইভ/g, " pendrive "],
    [/মেমোরি\s*কার্ড/g, " memory card "],
    [/টেরাবাইট/g, " tb "],
    [/গিগাবাইট/g, " gb "],
    [/মেগাবাইট/g, " mb "],
    [/ডিডিআর\s*([345])/g, " ddr$1 "],
    [/জিবি/g, " gb "],
    [/টিবি/g, " tb "],
    [/এমবি/g, " mb "],
    [/দাম|মূল্য/g, " price "],
    [/স্টকে?/g, " stock "],
    [/ওয়ারেন্টি|গ্যারান্টি/g, " warranty "],
    [/ডেলিভারি|কুরিয়ার/g, " delivery "],
    [/পেমেন্ট/g, " payment "],
    [/অর্ডার/g, " order "],
    [/ট্র্যাকিং|ট্র্যাক/g, " tracking "],
    [/যোগাযোগ/g, " contact "],
    [/ঠিকানা/g, " address "],
    [/দোকান|শোরুম/g, " showroom "],
    [/হটলাইন/g, " hotline "],
    [/ইমেইল/g, " email "],
    [/ডিলার/g, " dealer "],
    [/পার্টনার/g, " partner "],
    [/পাইকারি/g, " wholesale "],
    [/অফার/g, " offer "],
    [/ডিসকাউন্ট/g, " discount "],
    [/প্রোডাক্ট|পণ্য/g, " product "],
    [/ব্র্যান্ড/g, " brand "],
    [/ক্যাটাগরি/g, " category "],
    [/প্রাইস/g, " price "],
    [/টাকার|টাকা/g, " taka "],
    [/হাজার/g, " thousand "],
    [/ভিতরে|মধ্যে/g, " moddhe "],
    [/নিচে/g, " niche "],
    [/উপরে/g, " upor "],
    [/সস্তা/g, " cheap "],
    [/দামি/g, " expensive "],
    [/ভালো/g, " good "],
    [/নতুন/g, " new "],
    [/আসল/g, " genuine "],
    [/নকল/g, " fake "],
    [/রিটার্ন/g, " return "],
    [/রিফান্ড/g, " refund "],
    [/ফেরত/g, " return "],
    [/বাতিল/g, " cancel "],
    [/কোথায়/g, " where "],
    [/কিভাবে|কীভাবে/g, " how "],
    [/কেন/g, " why "],
    [/কবে/g, " when "],
    [/প্রায়/g, " around "],
    [/কত/g, " how much "],
    [/আছে/g, " available "],
    [/নেই/g, " not available "]
];

function normalize(value) {
    let s = asciiDigits(value).toLowerCase();

    s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

    BN_REPLACEMENTS.forEach(function (pair) {
        s = s.replace(pair[0], pair[1]);
    });

    s = s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
    s = s.replace(/wi[\s-]?fi/g, " wifi ");
    s = s.replace(/\bm2\b/g, " m.2 ");
    s = s.replace(/[^a-z0-9\u0980-\u09FF+\s.]/g, " ");
    s = s.replace(/(\d+)\s*(gb|tb|mb)\b/g, "$1$2");
    s = s.replace(/\bddr\s+([345])\b/g, "ddr$1");
    s = s.replace(/\bgen\s+([345])\b/g, "gen$1");
    s = s.replace(/\s+/g, " ").trim();

    return s;
}

const STOPWORDS = new Set(
    ("a an the and or of for to in on at is are was were be been being " +
        "do does did doing have has had having i you your we our they their " +
        "he she it this that these those what which who whom whose when where why how " +
        "can could should would will shall may might must " +
        "please kindly tell give show want need know any some about from with without " +
        "me my us our find search looking lookingfor " +
        "price Prices cost rate taka tk budget cheap cheapest expensive best good top " +
        "recommend suggest premium lowest highest " +
        "stock available availability availability " +
        "product products item items model models sell selling " +
        "er e ta ti te ke se tai ebong ar o r ki kii koto kemon kivabe kothay keno kar kon " +
        "bhai vai sir madam please vs versus compare difference")
        .split(/\s+/)
        .filter(Boolean)
);

const TOKEN_SYNONYMS = {
    ssd: ["solid", "state", "drive"],
    hdd: ["hard", "disk"],
    ram: ["memory"],
    vga: ["graphics"],
    gpu: ["graphics"],
    mobo: ["motherboard"],
    mainboard: ["motherboard"],
    psu: ["power", "supply"],
    wifi: ["router"],
    pendrive: ["pen", "drive"],
    microsd: ["memory"]
};

const PLURAL_KEEP = new Set(["ups", "news", "series", "yes", "plus", "lens"]);

function singularOf(token) {
    if (/^[a-z]{3,}s$/.test(token) && !/ss$/.test(token) && !PLURAL_KEEP.has(token)) {
        return token.slice(0, -1);
    }
    return "";
}

function queryTokens(value) {
    const raw = normalize(value).split(/\s+/).filter(Boolean);
    const out = [];

    raw.forEach(function (token) {
        const t = token.replace(/^\.+|\.+$/g, "");
        if (!t || t.length < 2) return;
        if (STOPWORDS.has(t)) return;

        out.push(t);

        const singular = singularOf(t);
        if (singular) out.push(singular);
    });

    const set = new Set(out);

    Array.from(set).forEach(function (t) {
        const syn = TOKEN_SYNONYMS[t];
        if (syn) syn.forEach(function (s) { set.add(s); });
    });

    return Array.from(set);
}

/* ---------- query parsing ---------- */

function numberValue(text) {
    return Number(String(text || "").replace(/,/g, ""));
}

function budgetUnit(unit) {
    return unit && /^(k|thousand|হাজার)$/i.test(unit) ? 1000 : 1;
}

function parseBudget(n) {
    const result = { min: null, max: null };
    let m;

    m = n.match(/(?:under|below|less than|within|max(?:imum)?|budget|moddhe|niche|kom|ভিতরে|মধ্যে|নিচে)(?:\s+(?:of|around|about))?\s*(?:tk|taka)?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|হাজার)?/i);
    if (m) {
        const v = numberValue(m[1]) * budgetUnit(m[2]);
        if (v >= 100) result.max = v;
    }

    m = n.match(/([\d,]+(?:\.\d+)?)\s*(?:k|thousand|হাজার)?\s*(?:tk|taka|টাকার|টাকা)?\s*(?:er|r|র)?\s*(?:moddhe|niche|within|under|ভিতরে|মধ্যে|নিচে)/i);
    if (m) {
        const v = numberValue(m[1]) * budgetUnit(m[0].match(/\b(k|thousand|হাজার)\b/i) && m[0].match(/\b(k|thousand|হাজার)\b/i)[1]);
        if (v >= 100 && (result.max === null || v < result.max)) result.max = v;
    }

    m = n.match(/(?:over|above|more than|beshi|upor|উপরে|বেশি)\s*(?:tk|taka)?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|হাজার)?/i);
    if (m) {
        const v = numberValue(m[1]) * budgetUnit(m[2]);
        if (v >= 100) result.min = v;
    }

    m = n.match(/(?:around|about|approx(?:imately)?|near|kache|kacher|প্রায়)\s*(?:tk|taka)?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|হাজার)?/i);
    if (m) {
        const v = numberValue(m[1]) * budgetUnit(m[2]);
        if (v >= 100) {
            result.min = Math.round(v * 0.8);
            result.max = Math.round(v * 1.2);
        }
    }

    return result;
}

function parseCapacity(n) {
    const m = n.match(/\b(\d+)\s*(gb|tb)\b/i);
    return m ? m[1] + m[2].toLowerCase() : "";
}

function parseDdr(n) {
    const m = n.match(/\bddr\s?([345])\b/i);
    return m ? m[1] : "";
}

function parseInterfaces(n) {
    const out = [];
    if (/\bnvme\b/.test(n)) out.push("nvme");
    if (/\bsata\b/.test(n)) out.push("sata");
    if (/\bm\.?\s*2\b/.test(n)) out.push("m.2");
    const gen = n.match(/\bgen\s?([345])\b/i);
    if (gen) out.push("gen" + gen[1]);
    return out;
}

function looksLikeModelToken(token) {
    return (
        /[a-z]/.test(token) &&
        /[0-9]/.test(token) &&
        token.length >= 3 &&
        !/^\d+(gb|tb|mb)$/.test(token) &&
        !/^ddr[345]$/.test(token) &&
        !/^gen[345]$/.test(token) &&
        !/^pcie/.test(token) &&
        !/^m\.?2$/.test(token)
    );
}

/* ---------- brands ---------- */

const BRAND_ALIASES = [
    { alias: "aitc kingsman gaming", name: "AITC Kingsman Gaming" },
    { alias: "aitc kingsman", name: "AITC Kingsman Gaming" },
    { alias: "kingsman gaming", name: "AITC Kingsman Gaming" },
    { alias: "kingsman", name: "AITC Kingsman Gaming" },
    { alias: "aitc", name: "AITC Kingsman Gaming" },
    { alias: "kingspec", name: "KingSpec" },
    { alias: "king spec", name: "KingSpec" },
    { alias: "powersync", name: "PowerSync" },
    { alias: "power sync", name: "PowerSync" },
    { alias: "xentrha", name: "Xentrha" },
    { alias: "xenthra", name: "Xentrha" },
    { alias: "unika", name: "Unika" }
];

function detectBrand(n) {
    const sorted = BRAND_ALIASES.slice().sort(function (a, b) {
        return b.alias.length - a.alias.length;
    });

    for (const brand of sorted) {
        if (new RegExp("\\b" + escapeRe(brand.alias) + "\\b", "i").test(n)) {
            return brand.name;
        }
    }

    return "";
}

/* ---------- categories ---------- */

const CATEGORY_ALIASES = [
    { re: /\bportable\s+ssd\b/, name: "Portable SSD", slug: "portable-ssd", search: "portable ssd" },
    { re: /\bnvme\b/, name: "NVMe SSD", slug: "ssd", search: "nvme" },
    { re: /\bsata\b/, name: "SATA SSD", slug: "ssd", search: "sata" },
    { re: /\bm\.?\s*2\b/, name: "M.2 SSD", slug: "ssd", search: "m.2" },
    { re: /\bssds?\b|\bsolid\s+state\b/, name: "SSD", slug: "ssd", search: "ssd" },
    { re: /\bhdd\b|\bhard\s+disk\b|\bhard\s+drive\b/, name: "HDD", slug: "", search: "hdd" },
    { re: /\bmemory\s+card\b|\bmicrosd\b|\bsd\s+card\b/, name: "Memory Card", slug: "microsd-memory-card", search: "memory card" },
    { re: /\bdesktop\s+ram\b/, name: "Desktop RAM", slug: "desktop-ram", search: "desktop ram" },
    { re: /\blaptop\s+ram\b/, name: "Laptop RAM", slug: "laptop-ram", search: "laptop ram" },
    { re: /\bddr\s?3\b/, name: "DDR3 RAM", slug: "", search: "ddr3" },
    { re: /\bddr\s?4\b/, name: "DDR4 RAM", slug: "", search: "ddr4" },
    { re: /\bddr\s?5\b/, name: "DDR5 RAM", slug: "", search: "ddr5" },
    { re: /\bram\b|\bmemory\b/, name: "RAM", slug: "", search: "ram" },
    { re: /\bmotherboard\b|\bmobo\b|\bmainboard\b/, name: "Motherboard", slug: "motherboard", search: "motherboard" },
    { re: /\bgraphics\s+card\b|\bgpu\b|\bvga\b/, name: "Graphics Card", slug: "graphics-card", search: "graphics card" },
    { re: /\bprocessor\b|\bcpu\b/, name: "Processor", slug: "", search: "processor" },
    { re: /\bcasing\b|\bchassis\b|\bcase\b/, name: "Casing", slug: "", search: "casing" },
    { re: /\bpower\s+supply\b|\bpsu\b|\bsmps\b/, name: "Power Supply", slug: "", search: "power supply" },
    { re: /\bmonitor\b|\bdisplay\b/, name: "Monitor", slug: "", search: "monitor" },
    { re: /\bkeyboard\b/, name: "Keyboard", slug: "", search: "keyboard" },
    { re: /\bmouse\b|\bmice\b/, name: "Mouse", slug: "", search: "mouse" },
    { re: /\bprinter\b/, name: "Printer", slug: "", search: "printer" },
    { re: /\blaptop\b|\bnotebook\b/, name: "Laptop", slug: "", search: "laptop" },
    { re: /\brouter\b|\bwifi\b/, name: "Router", slug: "", search: "router" },
    { re: /\bups\b/, name: "UPS", slug: "", search: "ups" },
    { re: /\bwebcam\b/, name: "Webcam", slug: "", search: "webcam" },
    { re: /\bpendrive\b|\bpen\s+drive\b|\bflash\s+drive\b/, name: "Pen Drive", slug: "", search: "pendrive" },
    { re: /\battendance\b|\bfingerprint\b/, name: "Attendance System", slug: "attendance-system", search: "attendance" },
    { re: /\baccessor(?:y|ies)\b/, name: "Accessories", slug: "accessories", search: "accessories" },
    { re: /\bcamera\b|\bcctv\b/, name: "Camera", slug: "", search: "camera" }
];

function detectCategory(n) {
    const singular = n.split(/\s+/)
        .map(singularOf)
        .filter(Boolean)
        .join(" ");
    const haystack = singular ? n + " " + singular : n;

    for (const category of CATEGORY_ALIASES) {
        if (category.re.test(haystack)) return category;
    }
    return null;
}

/* Broader family used to keep a search inside the asked category.
   Without this, a "RAM under 3000" query could return a MicroSD card. */
function categoryFamily(category) {
    if (!category) return "";
    const name = category.name;

    if (/ssd/i.test(name)) return "ssd";
    if (/hdd/i.test(name)) return "hdd";
    if (/memory card/i.test(name)) return "memory card";
    if (/ram/i.test(name)) return "ram";
    if (/graphics/i.test(name)) return "graphics card";
    if (/motherboard/i.test(name)) return "motherboard";
    if (/processor/i.test(name)) return "processor";
    if (/power supply/i.test(name)) return "power supply";
    if (/pen drive/i.test(name)) return "pendrive";
    if (/attendance/i.test(name)) return "attendance";

    return normalize(name);
}

function inCategory(product, category) {
    if (!category) return true;

    if (category.name === "Laptop") {
        const exact = product.cats.some(function (c) {
            return /^laptop$/i.test(normalize(c));
        });
        if (exact) return true;
        return /^laptop\b/.test(product.titleNorm) &&
            !/\b(ram|memory|ssd|hdd|keyboard|battery|charger|bag)\b/.test(product.titleNorm);
    }

    if (category.name === "Accessories") return true;

    const family = categoryFamily(category);
    if (!family) return true;

    return product.catNorm.includes(family) || product.titleNorm.includes(family);
}

function platformOf(q) {
    if (/\blaptop\b|\bnotebook\b/.test(q.norm)) return "laptop";
    if (/\bdesktop\b/.test(q.norm)) return "desktop";
    return "";
}

function inPlatform(product, platform) {
    if (!platform) return true;
    return (product.titleNorm + " " + product.catNorm).includes(platform);
}

function inInterfaces(product, interfaces) {
    if (!interfaces || !interfaces.length) return true;
    return interfaces.every(function (iface) {
        return product.searchNorm.includes(iface);
    });
}

/* ---------- knowledge cache ---------- */

function cleanCopy(title) {
    let out = String(title || "").replace(/\s+/g, " ").trim();
    while (/\s+copy\s*$/i.test(out)) {
        out = out.replace(/\s+copy\s*$/i, "").trim();
    }
    return out;
}

function productPrice(p) {
    if (p.callForPrice || p.price === null || p.price === undefined) {
        return "Call for price";
    }
    return "৳ " + Number(p.price).toLocaleString("en-IN");
}

function productStock(p) {
    return p.stockStatus || "In Stock";
}

function stockRank(status) {
    switch (status) {
        case "In Stock": return 0;
        case "Pre Order": return 1;
        case "Coming Soon": return 2;
        case "Out of Stock": return 3;
        default: return 0;
    }
}

function indexProduct(p) {
    const title = cleanCopy(p.title);
    const cats = [p.mainCategory, p.subCategory, p.childCategory].filter(Boolean);
    const specs = (p.specs || [])
        .filter(function (s) { return s && s.key && s.value; })
        .map(function (s) {
            return { key: stripHtml(s.key), value: stripHtml(s.value) };
        });
    const specText = specs.map(function (s) { return s.key + " " + s.value; }).join(" ");

    return {
        title: p.title,
        cleanTitle: title,
        slug: p.slug,
        brand: p.brand || "",
        cats: cats,
        price: p.salePrice || p.regularPrice || null,
        callForPrice: p.callForPrice === true,
        stockStatus: productStock(p),
        specs: specs,
        titleNorm: normalize(title),
        capacities: normalize(title).match(/\b\d+(?:gb|tb|mb)\b/g) || [],
        brandNorm: normalize(p.brand || ""),
        catNorm: normalize(cats.join(" ")),
        searchNorm: normalize(
            title + " " + (p.brand || "") + " " + cats.join(" ") + " " +
            stripHtml(p.shortDesc) + " " + specText
        ),
        createdAt: p.createdAt
    };
}

function buildKnowledge(products, categories, faqs) {
    const indexed = products.map(indexProduct);

    const seedBrands = [
        "KingSpec",
        "AITC Kingsman Gaming",
        "Xentrha",
        "Unika",
        "PowerSync"
    ];

    const brands = seedBrands.slice();
    const seen = new Set(brands.map(function (b) { return normalize(b); }));

    indexed.forEach(function (p) {
        const name = (p.brand || "").trim();
        const key = normalize(name);
        if (!name || !key || seen.has(key)) return;
        seen.add(key);
        brands.push(name);
    });

    return {
        at: Date.now(),
        products: indexed,
        categories: categories,
        faqs: faqs,
        brands: Array.from(brands)
    };
}

async function getKnowledge() {
    if (knowledge.at && Date.now() - knowledge.at < CACHE_MS) {
        return knowledge;
    }

    if (loading) return loading;

    loading = (async function () {
        try {
            const [products, categories, faqs] = await Promise.all([
                Product.find({ isActive: true })
                    .select("title slug brand mainCategory subCategory childCategory regularPrice salePrice callForPrice stockStatus specs shortDesc createdAt")
                    .lean(),
                Category.find({ isActive: true })
                    .select("name slug parent order")
                    .sort({ order: 1, name: 1 })
                    .lean(),
                Faq.find({ isActive: true })
                    .select("category question answer")
                    .lean()
            ]);

            knowledge = buildKnowledge(products, categories, faqs);
        } catch (error) {
            console.error("Chat knowledge load error:", error.message);
            if (!knowledge.at) knowledge.at = Date.now();
        } finally {
            loading = null;
        }

        return knowledge;
    })();

    return loading;
}

/* ---------- product search ---------- */

function buildQuery(text) {
    const raw = String(text || "").trim();
    const n = normalize(raw);
    const tokens = queryTokens(raw);
    const category = detectCategory(n);

    return {
        raw: raw,
        norm: n,
        tokens: tokens,
        budget: parseBudget(n),
        capacity: parseCapacity(n),
        ddr: parseDdr(n),
        interfaces: parseInterfaces(n),
        category: category,
        brand: detectBrand(n),
        stockFilter: detectStockFilter(n),
        sort: detectSort(n),
        modelTokens: tokens.filter(looksLikeModelToken)
    };
}

function hasProductSubject(q) {
    return Boolean(
        q.category ||
        q.brand ||
        q.capacity ||
        q.ddr ||
        q.interfaces.length ||
        q.modelTokens.length ||
        q.tokens.some(function (t) { return PRODUCT_TOKEN_RE.test(t); })
    );
}

const PRODUCT_TOKEN_RE = /\b(ssds?|hdd|ram|memory|nvme|sata|m\.2|gpu|vga|graphics|processor|cpu|motherboard|mobo|mainboard|psu|casing|chassis|monitor|keyboard|mouse|mice|printer|laptop|router|wifi|ups|webcam|pendrive|microsd|attendance|camera|cctv|portable)\b/i;

function detectStockFilter(n) {
    if (/\b(out of stock|stock out|not available|outofstock)\b|স্টক নেই|নেই/.test(n)) return "out";
    if (/\b(pre order|preorder)\b|প্রি অর্ডার/.test(n)) return "pre";
    if (/\b(coming soon)\b|শীঘ্রই/.test(n)) return "soon";
    if (/\b(in stock|available|ache|achhe|ase|achhey)\b|আছে/.test(n)) return "in";
    return "";
}

function detectSort(n) {
    if (/\b(cheap|cheapest|lowest|kom dam|low price)\b|সস্তা/.test(n)) return "price_asc";
    if (/\b(expensive|premium|highest|beshi dam)\b|দামি/.test(n)) return "price_desc";
    if (/\b(new|latest|newest)\b|নতুন/.test(n)) return "new";
    return "relevance";
}

function scoreProduct(product, q) {
    let score = 0;
    let matched = 0;

    q.tokens.forEach(function (token) {
        if (product.titleNorm.includes(token)) {
            score += /[0-9]/.test(token) ? 8 : 6;
            matched += 1;
        } else if (product.brandNorm.includes(token)) {
            score += 4;
            matched += 1;
        } else if (product.catNorm.includes(token)) {
            score += 3;
            matched += 1;
        } else if (product.searchNorm.includes(token)) {
            score += 1;
            matched += 1;
        }
    });

    if (q.tokens.length && matched === q.tokens.length) score += 6;

    if (q.capacity && product.searchNorm.includes(q.capacity)) score += 8;
    if (q.ddr && product.searchNorm.includes("ddr" + q.ddr)) score += 6;

    q.interfaces.forEach(function (iface) {
        if (product.searchNorm.includes(iface)) score += 5;
    });

    if (q.brand && product.searchNorm.includes(normalize(q.brand))) score += 6;

    if (q.category && q.category.search && product.catNorm.includes(q.category.search)) {
        score += 4;
    }

    q.modelTokens.forEach(function (model) {
        if (product.titleNorm.includes(model)) score += 10;
    });

    if (!matched && !q.modelTokens.length && !q.category && !q.brand) return 0;

    if (/\blaptop\b/.test(q.norm) && /\blaptop\b/.test(product.titleNorm + " " + product.catNorm)) {
        score += 8;
    }
    if (/\bdesktop\b/.test(q.norm) && /\bdesktop\b/.test(product.titleNorm + " " + product.catNorm)) {
        score += 8;
    }

    return score;
}

function searchProducts(k, q) {
    const strong = Boolean(
        q.category || q.brand || q.capacity || q.ddr ||
        q.interfaces.length || q.modelTokens.length
    );
    const threshold = strong ? 4 : 8;

    let items = k.products
        .map(function (product) {
            return { product: product, score: scoreProduct(product, q) };
        })
        .filter(function (item) { return item.score >= threshold; });

    if (q.category) {
        items = items.filter(function (item) {
            return inCategory(item.product, q.category);
        });
    }

    if (q.brand) {
        const brandKey = normalize(q.brand);
        const branded = items.filter(function (item) {
            return item.product.brandNorm.includes(brandKey) ||
                item.product.searchNorm.includes(brandKey);
        });
        if (branded.length) items = branded;
    }

    if (q.interfaces.length) {
        const matched = items.filter(function (item) {
            return inInterfaces(item.product, q.interfaces);
        });
        if (matched.length) items = matched;
    }

    if (q.capacity) {
        const exact = items.filter(function (item) {
            return item.product.capacities.indexOf(q.capacity) !== -1;
        });
        if (exact.length) items = exact;
    }

    const platform = platformOf(q);
    if (platform && q.category && /ram/i.test(q.category.name)) {
        const scoped = items.filter(function (item) {
            return inPlatform(item.product, platform);
        });
        items = scoped;
    }

    if (q.budget.min !== null || q.budget.max !== null) {
        items = items.filter(function (item) {
            const price = item.product.price;
            if (price === null || price === undefined) return false;
            if (q.budget.min !== null && price < q.budget.min) return false;
            if (q.budget.max !== null && price > q.budget.max) return false;
            return true;
        });
    }

    if (q.stockFilter) {
        const wanted = {
            in: "In Stock",
            pre: "Pre Order",
            soon: "Coming Soon",
            out: "Out of Stock"
        }[q.stockFilter];

        items = items.filter(function (item) {
            return item.product.stockStatus === wanted;
        });
    }

    items.sort(function (a, b) {
        if (q.sort === "price_asc") {
            return (a.product.price === null ? Infinity : a.product.price) -
                (b.product.price === null ? Infinity : b.product.price);
        }
        if (q.sort === "price_desc") {
            return (b.product.price === null ? -Infinity : b.product.price) -
                (a.product.price === null ? -Infinity : a.product.price);
        }
        if (q.sort === "new") {
            return new Date(b.product.createdAt || 0) - new Date(a.product.createdAt || 0);
        }
        if (b.score !== a.score) return b.score - a.score;

        const rank = stockRank(a.product.stockStatus) - stockRank(b.product.stockStatus);
        if (rank !== 0) return rank;

        return (a.product.price === null ? Number.MAX_SAFE_INTEGER : a.product.price) -
            (b.product.price === null ? Number.MAX_SAFE_INTEGER : b.product.price);
    });

    const seen = new Set();
    const unique = [];

    items.forEach(function (item) {
        if (seen.has(item.product.titleNorm)) return;
        seen.add(item.product.titleNorm);
        unique.push(item);
    });

    return unique;
}

function findProductBySlug(k, slug) {
    return k.products.find(function (p) { return p.slug === slug; }) || null;
}

/* ---------- product answers ---------- */

function viewAllLink(q) {
    const params = [];

    if (q.category) {
        if (q.category.slug) params.push("cat=" + encodeURIComponent(q.category.slug));
        if (q.category.search) {
            params.push("search=" + encodeURIComponent(q.category.search));
        } else if (q.brand) {
            params.push("search=" + encodeURIComponent(q.brand));
        }
    } else if (q.brand) {
        params.push("search=" + encodeURIComponent(q.brand));
    } else if (q.modelTokens.length) {
        params.push("search=" + encodeURIComponent(q.modelTokens[0]));
    }

    if (q.brand) params.push("brand=" + encodeURIComponent(q.brand));

    if (q.budget.min !== null) params.push("min=" + q.budget.min);
    if (q.budget.max !== null) params.push("max=" + q.budget.max);
    if (q.stockFilter === "in") params.push("stock=1");

    return "/shop" + (params.length ? "?" + params.join("&") : "");
}

function formatProductBullet(product) {
    return [
        "• " + product.cleanTitle,
        "  " + productPrice(product) + " · " + product.stockStatus,
        "  /product/" + product.slug
    ].join("\n");
}

function formatProductDetail(product) {
    const lines = [
        product.cleanTitle,
        "",
        "Price: " + productPrice(product),
        "Availability: " + product.stockStatus
    ];

    if (product.brand) lines.push("Brand: " + product.brand);
    if (product.cats.length) lines.push("Category: " + product.cats.join(" > "));

    const specs = product.specs.slice(0, 5);
    if (specs.length) {
        lines.push("", "Key specs:");
        specs.forEach(function (s) {
            lines.push("• " + s.key + ": " + s.value.slice(0, 120));
        });
    }

    lines.push("", "Full details & order: /product/" + product.slug);

    if (product.callForPrice || product.price === null) {
        lines.push("Call " + (siteConfig.hotline || "+8801709967815") + " for the current price.");
    }

    return lines.join("\n");
}

function productListAnswer(k, q, items) {
    const top = items.slice(0, 3);
    const lines = [];

    if (q.budget.max !== null) {
        lines.push("Options under ৳ " + Number(q.budget.max).toLocaleString("en-IN") + ":");
    } else if (q.stockFilter === "in") {
        lines.push("Available now:");
    } else if (q.sort === "price_asc") {
        lines.push("Lowest prices first:");
    } else if (q.brand && q.category) {
        lines.push(q.brand + " " + q.category.name + " options:");
    } else if (q.brand) {
        lines.push(q.brand + " products:");
    } else if (q.category) {
        lines.push(q.category.name + " options:");
    } else {
        lines.push("Here is what I found:");
    }

    top.forEach(function (item) {
        lines.push("", formatProductBullet(item.product));
    });

    if (items.length > top.length) {
        lines.push("", "Showing " + top.length + " of " + items.length + " matching products.");
    }

    lines.push("", "View all: " + viewAllLink(q));
    lines.push("Reply with a model name for details, or type \"agent\" to ask our team.");

    return lines.join("\n");
}

function productSearchAnswer(k, q, items) {
    const top = items[0];
    const second = items[1];
    const specific = Boolean(
        q.capacity ||
        q.modelTokens.length ||
        (q.brand && q.category && q.tokens.length >= 3)
    );

    if (items.length === 1 || (specific && top && (!second || top.score - second.score >= 12))) {
        return formatProductDetail(top.product);
    }

    return productListAnswer(k, q, items);
}

function noProductAnswer(k, q) {
    const uniqueCount = new Set(k.products.map(function (p) { return p.titleNorm; })).size;
    const platform = platformOf(q);
    let subject = q.category ? q.category.name :
        (q.brand ? q.brand : (q.modelTokens.length ? q.modelTokens[0].toUpperCase() : "that product"));

    if (platform && q.category && !new RegExp("\\b" + platform + "\\b", "i").test(subject)) {
        subject = platform.charAt(0).toUpperCase() + platform.slice(1) + " " + subject;
    }

    const lines = [];

    if (q.budget.max !== null) {
        const scoped = k.products
            .filter(function (p) {
                return p.price !== null && p.price !== undefined &&
                    inCategory(p, q.category) && inPlatform(p, platform) &&
                    inInterfaces(p, q.interfaces);
            })
            .sort(function (a, b) { return a.price - b.price; });

        const above = scoped.filter(function (p) { return p.price > q.budget.max; })[0];

        lines.push("No " + subject + " found under ৳ " + Number(q.budget.max).toLocaleString("en-IN") + ".");

        if (above) {
            lines.push("", "The closest option starts at " + productPrice(above) + ":", "", formatProductBullet(above));
        }

        lines.push("", "Browse all " + subject + ": " + viewAllLink({
            category: q.category,
            brand: q.brand,
            modelTokens: q.modelTokens,
            budget: { min: null, max: null },
            stockFilter: q.stockFilter
        }));
    } else if (q.category) {
        lines.push("We don't currently have " + subject + " products in our active catalogue.");
        lines.push("", "Browse the full catalogue: " + viewAllLink(q));
    } else {
        lines.push("I couldn't find " + subject + " in our current catalogue of " + uniqueCount + " products.");
        lines.push("", "Browse the full catalogue: " + viewAllLink(q));
    }

    lines.push("", "Or type \"agent\" and our team will check availability, or call " +
        (siteConfig.hotline || "+8801709967815") + ".");

    return lines.join("\n");
}

/* ---------- FAQ ---------- */

function faqCacheText(faq) {
    return {
        question: stripHtml(faq.question).slice(0, 240),
        answer: stripHtml(faq.answer).slice(0, 900),
        category: stripHtml(faq.category || "")
    };
}

function findFaq(k, q) {
    if (!k.faqs.length || !q.tokens.length) return null;

    let best = null;
    let bestScore = 0;
    let bestMatched = 0;
    const tokens = q.tokens.filter(function (t) { return t.length >= 3; });

    k.faqs.forEach(function (faq) {
        const question = normalize(faq.question);
        const category = normalize(faq.category || "");
        const answer = normalize(stripHtml(faq.answer));

        let score = 0;
        let matched = 0;

        tokens.forEach(function (token) {
            if (question.includes(token)) {
                score += 4;
                matched += 1;
            } else if (category.includes(token)) {
                score += 2;
                matched += 1;
            } else if (answer.includes(token)) {
                score += 1;
                matched += 1;
            }
        });

        if (q.norm.length >= 8 && question.includes(q.norm)) score += 12;

        if (score > bestScore) {
            bestScore = score;
            bestMatched = matched;
            best = faq;
        }
    });

    if (!best) return null;

    const coverage = tokens.length ? bestMatched / tokens.length : 0;
    if (bestScore >= 4 && (coverage >= 0.5 || bestScore >= 8)) {
        return { faq: best, score: bestScore };
    }

    return null;
}

function faqAnswer(faq) {
    const text = faqCacheText(faq);
    const lines = [text.question, "", text.answer];

    const q = text.question.toLowerCase();
    if (/delivery|shipping/.test(q)) lines.push("", "Delivery details: /delivery-method");
    else if (/payment|bkash/.test(q)) lines.push("", "Payment details: /payment-method");
    else if (/warranty/.test(q)) lines.push("", "Warranty page: /warranty");
    else if (/dealer|partner|wholesale/.test(q)) lines.push("", "Registration: /become-a-partner");
    else if (/track/.test(q)) lines.push("", "Track here: /order-tracking");
    else lines.push("", "More FAQs: /faq");

    return lines.join("\n");
}

/* ---------- site answers ---------- */

function deliveryAnswer() {
    const inside = Number(siteConfig.shipping && siteConfig.shipping.insideDhaka) || 80;
    const outside = Number(siteConfig.shipping && siteConfig.shipping.outsideDhaka) || 120;

    return [
        "Delivery charges:",
        "• Inside Dhaka: ৳ " + inside.toLocaleString("en-IN"),
        "• Outside Dhaka: ৳ " + outside.toLocaleString("en-IN"),
        "",
        "Delivery time:",
        "• Inside Dhaka: 24–48 hours",
        "• Outside Dhaka: 2–4 business days",
        "",
        "Cash on Delivery is available across Bangladesh.",
        "Details: /delivery-method"
    ].join("\n");
}

function paymentAnswer() {
    const bkash = siteConfig.bkash || {};
    const bank = siteConfig.bank || {};
    const charge = Number(bkash.chargePercent || 1.15);

    const bkashLine = bkash.number
        ? "• bKash — " + bkash.number + (bkash.type ? " (" + bkash.type + ")" : "") +
          " — " + charge + "% charge added automatically"
        : "• bKash — " + charge + "% charge added automatically";

    const bankLine = "• Bank transfer" +
        (bank.bankName ? " — " + bank.bankName : "") +
        (bank.accountName ? " (" + bank.accountName + ")" : "");

    return [
        "We accept:",
        bkashLine,
        "• Cash on Delivery (COD)",
        bankLine,
        "",
        "At checkout you can see the bKash QR code and full bank details.",
        "Payment details: /payment-method"
    ].join("\n");
}

function warrantyAnswer(product) {
    if (product) {
        const warranty = product.specs.find(function (s) {
            return /warranty|guarantee/i.test(s.key);
        });

        return [
            "Warranty for " + product.cleanTitle + ":",
            warranty ? "• " + warranty.key + ": " + warranty.value : "• Official brand warranty applies.",
            "",
            "To claim warranty, bring or courier the product with your invoice/order number to our showroom.",
            "Warranty page: /warranty",
            "Product page: /product/" + product.slug
        ].join("\n");
    }

    return [
        "Yes — almost all our products carry an official brand warranty (typically 3 years to lifetime, depending on the product).",
        "Warranty details are listed on each product page.",
        "",
        "To claim warranty, bring or courier the product with your invoice or order number to our showroom.",
        "",
        "Warranty page: /warranty"
    ].join("\n");
}

function returnAnswer() {
    return [
        "Returns and refunds depend on the product's condition and warranty policy.",
        "Please contact our team with your order number so we can check the eligibility.",
        "",
        "Refund policy: /refund-policy",
        "Hotline: " + (siteConfig.hotline || "+8801709967815")
    ].join("\n");
}

function cancelAnswer(k) {
    const found = findFaq(k, buildQuery("cancel order"));
    if (found) return faqAnswer(found.faq);

    return [
        "You can cancel or change an order only if it has not been dispatched yet.",
        "Contact our hotline with your order number as soon as possible: " +
            (siteConfig.hotline || "+8801709967815"),
        "",
        "FAQs: /faq"
    ].join("\n");
}

function orderTrackAnswer() {
    return [
        "Track your order here: /order-tracking",
        "Enter your order number (for example MT-20261014-4F8K) and the mobile number used at checkout.",
        "",
        "You will also receive the order number by email and SMS after placing the order."
    ].join("\n");
}

function orderAnswer() {
    return [
        "How to order:",
        "1. Add the products to your cart.",
        "2. Open /checkout and log in.",
        "3. Enter your delivery address and choose bKash, Cash on Delivery or bank transfer.",
        "4. Confirm the order — you will receive an order number by email and SMS.",
        "",
        "Need help? Type \"agent\" or call " + (siteConfig.hotline || "+8801709967815") + "."
    ].join("\n");
}

function contactAnswer() {
    return [
        "Contact Mizan Trade:",
        "• Hotline: " + (siteConfig.hotline || "+8801709967815"),
        "• Email: " + (siteConfig.email || "support@mizantrade.com"),
        "• Address: " + (siteConfig.address || "Shop 301-303, Level 3, 69-71 New Elephant Road, Dhaka"),
        "• Showroom hours: Saturday–Thursday, 10:00 AM – 8:00 PM",
        "",
        "Contact page: /contact"
    ].join("\n");
}

function dealerAnswer() {
    return [
        "To become a dealer/partner:",
        "1. Submit the form at /become-a-partner with your business details and trade licence.",
        "2. Our team reviews the application and contacts you.",
        "3. Once approved, you get partner login access with dealer pricing.",
        "",
        "Documents: trade licence, shop/business address, mobile number and email. Corporate clients may also need a TIN certificate.",
        "",
        "Registration: /become-a-partner"
    ].join("\n");
}

function offersAnswer() {
    return [
        "Current discounted products are marked with strikethrough prices in the shop: /shop",
        "",
        "Partner and package offers are available in the Offers portal, which requires an approved partner login.",
        "Become a partner: /become-a-partner",
        "",
        "If you already have partner access: /partner/login"
    ].join("\n");
}

function aboutAnswer() {
    return [
        "Mizan Trade is a computer hardware importer and wholesale distributor in Bangladesh.",
        "We supply genuine SSDs, RAM, motherboards, graphics cards, casing, power supplies and other PC components from our Dhaka showroom.",
        "",
        "We are an authorized distributor of KingSpec, AITC Kingsman Gaming, Xentrha, Unika and PowerSync.",
        "",
        "About us: /about"
    ].join("\n");
}

function genuineAnswer() {
    return [
        "Yes — Mizan Trade is an authorized importer and distributor.",
        "Every product is sourced directly from manufacturers or their official regional distributors and is covered by official brand warranty.",
        "",
        "Look for the \"AUTHORIZED PRODUCT – Powered by MIZAN TRADE\" sticker when you receive the product.",
        "",
        "About us: /about"
    ].join("\n");
}

function categoryOverview(k, n) {
    if (/\bbrand/.test(n)) {
        return [
            "Our main brands:",
            k.brands.map(function (b) { return "• " + b; }).join("\n"),
            "",
            "Browse products by brand: /shop",
            "Search a brand here, for example: \"KingSpec SSD price\"."
        ].join("\n");
    }

    const tops = k.categories
        .filter(function (c) { return !c.parent; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
        .slice(0, 10);

    const uniqueCount = new Set(k.products.map(function (p) { return p.titleNorm; })).size;

    const lines = ["We currently have " + uniqueCount + " active products in these main categories:"];

    if (tops.length) {
        tops.forEach(function (c) {
            lines.push("• " + c.name + " — /shop?cat=" + c.slug);
        });
    } else {
        lines.push("• Browse the full catalogue: /shop");
    }

    lines.push("", "Brands: " + k.brands.join(", "));
    lines.push("Browse everything: /shop");

    return lines.join("\n");
}

function askWhichProduct() {
    return [
        "Which product are you asking about?",
        "Send the model or category, for example:",
        "• \"KingSpec 1TB NVMe SSD price\"",
        "• \"DDR4 8GB laptop RAM\"",
        "",
        "Or type \"agent\" to ask our team."
    ].join("\n");
}

/* ---------- follow-up context ---------- */

function detectFollowUp(q) {
    const n = q.norm;

    const siteBlock = /\b(delivery|shipping|courier|payment|bkash|nagad|rocket|bank|cod|contact|hotline|address|showroom|order|dealer|partner|wholesale|offer|discount|refund|return)\b/.test(n);
    if (siteBlock) return { is: false };

    const ref = /^(er|ei|eitar|oitar|tar|it|this|that|eta|ota|এর|এই|ওই|সেটার|সেই)\b/.test(n);
    const ordinal = /\b(1st|first|prothom|প্রথম|2nd|second|ditio|দ্বিতীয়|3rd|third|tritio|তৃতীয়|last|sesh|শেষ)\b/.test(n);
    const kindRe = /\b(price|dam|daam|cost|rate|how much|stock|available|ache|achhe|ase|achhey|spec|specs|specification|details|feature|warranty|guarantee|goranti|link|url|compare|vs|versus|difference)\b|দাম|মূল্য|কত|স্টক|আছে|স্পেসিফিকেশন|ওয়ারেন্টি/.test(n);

    const bare = kindRe && q.tokens.length <= 2 && !ordinal;
    const is = ref || ordinal || (bare && !hasProductSubject(q));

    return { is: is };
}

function ordinalIndex(n) {
    if (/\b(1st|first|prothom|প্রথম)\b/.test(n)) return 0;
    if (/\b(2nd|second|ditio|দ্বিতীয়)\b/.test(n)) return 1;
    if (/\b(3rd|third|tritio|তৃতীয়)\b/.test(n)) return 2;
    if (/\b(last|sesh|শেষ)\b/.test(n)) return -1;
    return null;
}

function followUpKind(n) {
    if (/\b(compare|vs|versus|difference)\b/.test(n)) return "compare";
    if (/\b(warranty|guarantee|goranti)\b|ওয়ারেন্টি/.test(n)) return "warranty";
    if (/\b(price|dam|daam|cost|rate|how much)\b|দাম|মূল্য|কত/.test(n)) return "price";
    if (/\b(stock|available|ache|achhe|ase|achhey|nai|nei)\b|স্টক|আছে|নেই/.test(n)) return "stock";
    if (/\b(spec|specs|specification|details|feature)\b|স্পেসিফিকেশন/.test(n)) return "specs";
    if (/\b(link|url|page)\b|লিংক/.test(n)) return "link";
    return "details";
}

function followUpAnswer(k, q, state) {
    const saved = state.lastProducts || [];
    if (!saved.length) return null;

    const n = q.norm;
    const kind = followUpKind(n);
    const index = ordinalIndex(n);

    let targets = saved;
    if (index !== null) {
        if (index === -1) targets = [saved[saved.length - 1]];
        else if (saved[index]) targets = [saved[index]];
        else targets = [saved[0]];
    }

    if (kind === "compare") {
        if (saved.length < 2) {
            return "I only have one product in this conversation. Send two model names to compare, for example: \"compare KingSpec 1TB SSD vs AITC 512GB SSD\".";
        }
        const a = findProductBySlug(k, saved[0].slug);
        const b = findProductBySlug(k, saved[1].slug);
        if (a && b) return compareAnswer(a, b);
    }

    if (kind === "link") {
        return "Here are the product links:\n\n" +
            targets.map(function (p) { return "• " + p.title + "\n  /product/" + p.slug; }).join("\n");
    }

    const full = targets
        .map(function (p) { return findProductBySlug(k, p.slug); })
        .filter(Boolean);

    if (!full.length) {
        return "I lost the product details. Please send the model name again.";
    }

    if (kind === "price") {
        return full.map(function (p) {
            return "• " + p.cleanTitle + "\n  " + productPrice(p) + " · " + p.stockStatus;
        }).join("\n") + "\n\nFull details: /product/" + full[0].slug;
    }

    if (kind === "stock") {
        return full.map(function (p) {
            return "• " + p.cleanTitle + "\n  " + p.stockStatus;
        }).join("\n") + "\n\nFull details: /product/" + full[0].slug;
    }

    if (kind === "warranty") {
        return warrantyAnswer(full[0]);
    }

    return formatProductDetail(full[0]);
}

/* ---------- compare ---------- */

function compareAnswer(a, b) {
    const lines = [
        "Quick comparison:",
        "",
        "• " + a.cleanTitle,
        "  " + productPrice(a) + " · " + a.stockStatus
    ];

    a.specs.slice(0, 4).forEach(function (s) {
        lines.push("  • " + s.key + ": " + s.value.slice(0, 80));
    });
    lines.push("  /product/" + a.slug, "");

    lines.push("• " + b.cleanTitle);
    lines.push("  " + productPrice(b) + " · " + b.stockStatus);

    b.specs.slice(0, 4).forEach(function (s) {
        lines.push("  • " + s.key + ": " + s.value.slice(0, 80));
    });
    lines.push("  /product/" + b.slug, "");

    if (a.price !== null && b.price !== null && a.price !== b.price) {
        lines.push("Lower price: " + (a.price < b.price ? a.cleanTitle : b.cleanTitle));
    }

    if (a.stockStatus !== b.stockStatus) {
        const inStock = [a, b].filter(function (p) { return p.stockStatus === "In Stock"; });
        if (inStock.length) {
            lines.push("In stock now: " + inStock.map(function (p) { return p.cleanTitle; }).join(", "));
        }
    }

    lines.push("", "Full side-by-side view: /compare");
    return lines.join("\n");
}

function compareFromMessage(k, q, state) {
    let body = q.raw.replace(/^\s*(?:compare|difference\s+between|contrast)\s+/i, "");
    const parts = body
        .split(/\s+(?:vs\.?|versus|theke)\s+/i)
        .map(function (s) { return s.trim(); })
        .filter(Boolean);

    if (parts.length >= 2) {
        const firstQuery = buildQuery(parts[0]);
        const secondQuery = buildQuery(parts[1]);
        const first = searchProducts(k, firstQuery)[0];
        const second = searchProducts(k, secondQuery)[0];
        if (first && second && first.product.slug !== second.product.slug) {
            return compareAnswer(first.product, second.product);
        }
    }

    const saved = state.lastProducts || [];
    if (saved.length >= 2) {
        const a = findProductBySlug(k, saved[0].slug);
        const b = findProductBySlug(k, saved[1].slug);
        if (a && b) return compareAnswer(a, b);
    }

    if (saved.length === 1) {
        return "I have one product from this chat: " + saved[0].title +
            ".\nSend another model to compare, for example: \"compare " + saved[0].title + " vs KingSpec 1TB SSD\".";
    }

    return "Send two model names to compare, for example:\n\"compare KingSpec 1TB NVMe SSD vs AITC 512GB SATA SSD\".";
}

/* ---------- state ---------- */

function normalizedState(input) {
    const state = input && typeof input === "object" ? input : {};
    return {
        lastIntent: typeof state.lastIntent === "string" ? state.lastIntent : "",
        lastCategory: typeof state.lastCategory === "string" ? state.lastCategory : "",
        lastProducts: Array.isArray(state.lastProducts)
            ? state.lastProducts
                .filter(function (p) { return p && p.slug; })
                .slice(0, 5)
                .map(function (p) {
                    return {
                        slug: String(p.slug),
                        title: String(p.title || ""),
                        price: String(p.price || ""),
                        stock: String(p.stock || "")
                    };
                })
            : []
    };
}

function nextState(previous, intent, items, category) {
    const state = normalizedState(previous);
    state.lastIntent = intent;
    if (category && category.name) state.lastCategory = category.name;

    if (items && items.length) {
        const seen = new Set();
        state.lastProducts = [];
        items.slice(0, 5).forEach(function (item) {
            if (seen.has(item.product.slug)) return;
            seen.add(item.product.slug);
            state.lastProducts.push({
                slug: item.product.slug,
                title: item.product.cleanTitle,
                price: productPrice(item.product),
                stock: item.product.stockStatus
            });
        });
    }

    return state;
}

/* ---------- optional AI ---------- */

/* Full store brief so the AI can answer ANY website-related question
   without inventing facts. Everything is pulled from the same live
   knowledge base and site config the rule engine uses. */
function buildAiContext(k, q, local, state) {
    const shipping = siteConfig.shipping || {};
    const bkash = siteConfig.bkash || {};
    const bank = siteConfig.bank || {};

    const lines = [
        "Store: " + (siteConfig.siteName || "Mizan Trade"),
        "Hotline/WhatsApp: " + (siteConfig.hotline || "+8801709967815"),
        "Email: " + (siteConfig.email || "support@mizantrade.com"),
        "Address: " + (siteConfig.address || "Shop 301-303, Level 3, 69-71 New Elephant Road, Dhaka"),
        "Showroom hours: Saturday-Thursday, 10:00 AM - 8:00 PM",
        "",
        "Delivery: inside Dhaka ৳ " + (Number(shipping.insideDhaka) || 80) +
            "; outside Dhaka ৳ " + (Number(shipping.outsideDhaka) || 120) +
            ". Time: inside Dhaka 24-48 hours; outside Dhaka 2-4 business days. Cash on Delivery available nationwide. Details: /delivery-method",
        "Payment: bKash " + (bkash.number || "") + (bkash.type ? " (" + bkash.type + ")" : "") +
            " with " + (bkash.chargePercent || 1.15) + "% charge added automatically; Cash on Delivery; bank transfer - " +
            (bank.bankName || "") + (bank.accountName ? " (" + bank.accountName + ")" : "") +
            (bank.accountNumber ? ", account " + bank.accountNumber : "") + ". Details: /payment-method",
        "How to order: add products to cart, open /checkout and log in, enter delivery address, choose bKash/COD/bank, confirm. The order number (like MT-20261014-4F8K) is sent by email and SMS.",
        "Order tracking: customer tracks at /order-tracking with the order number + mobile number used at checkout.",
        "Warranty: almost all products carry official brand warranty (typically 3 years to lifetime, see each product page). To claim, bring or courier the product with the invoice/order number to the showroom. Details: /warranty",
        "Returns/refunds: depend on product condition and warranty policy; customer should contact the team with the order number. Details: /refund-policy",
        "Dealer/wholesale: submit the form at /become-a-partner with business details and trade licence; team reviews; approved partners get dealer pricing via /partner/login.",
        "Authenticity: authorized importer/distributor of KingSpec, AITC Kingsman Gaming, Xentrha, Unika and PowerSync. Genuine products carry the \"AUTHORIZED PRODUCT - Powered by MIZAN TRADE\" sticker.",
        "Offers: discounted products are marked in /shop; partner/package offers need an approved partner login (/partner/login).",
        "",
        "Main categories: " + k.categories.filter(function (c) { return !c.parent; }).slice(0, 10)
            .map(function (c) { return c.name + " (/shop?cat=" + c.slug + ")"; }).join(", "),
        "Brands: " + k.brands.join(", ")
    ];

    if (local.items && local.items.length) {
        lines.push("", "Matching products for this question:");
        local.items.slice(0, 8).forEach(function (item) {
            lines.push("• " + item.product.cleanTitle + " — " + productPrice(item.product) +
                " — " + item.product.stockStatus + " — /product/" + item.product.slug);
        });
    } else if (state.lastProducts.length) {
        lines.push("", "Recently discussed products:");
        state.lastProducts.forEach(function (p) {
            lines.push("• " + p.title + " — " + p.price + " — " + p.stock + " — /product/" + p.slug);
        });
    }

    if (local.faq) {
        lines.push("", "Relevant FAQ:");
        lines.push("Q: " + stripHtml(local.faq.question));
        lines.push("A: " + stripHtml(local.faq.answer).slice(0, 700));
    }

    const otherFaqs = k.faqs
        .filter(function (f) { return !local.faq || String(f._id) !== String(local.faq._id); })
        .slice(0, 20)
        .map(function (f) { return "• " + stripHtml(f.question).slice(0, 120); });

    if (otherFaqs.length) {
        lines.push("", "More topics customers ask about (answer from the policies above when possible):");
        lines.push(otherFaqs.join("\n"));
    }

    if (local.category) lines.push("", "Customer is asking about category: " + local.category.name);
    if (local.brand) lines.push("Customer is asking about brand: " + local.brand);

    return lines.join("\n");
}

function cleanAiText(text) {
    return String(text || "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/`/g, "")
        .trim();
}

/* ---------- intents ---------- */

const HANDOFF_RE = /\b(agent|human|admin|operator|representative|real person|support team|talk to (someone|a person|an agent)|call me|someone call|kotha bolbo|kotha bolte|manush)\b|এজেন্ট|কথা বলতে|মানুষের সাথে/i;
const GREETING_RE = /^(hi+|hello+|hey+|yo|assalamu|assalam|salam|good (morning|afternoon|evening)|nomoshkar|নমস্কার|আসসালামু)\b/i;
const THANKS_RE = /\b(thanks|thank you|dhonnobad|dhanyabad|shukriya)\b|ধন্যবাদ/i;
const BYE_RE = /\b(bye|goodbye|see you|allah hafez|khoda hafez)\b|বিদায়/i;

const ORDER_TRACK_RE = /\b(track(?:ing)?|order status|where is my order|parcel|shipment status|order kothay|order er status)\b|ট্র্যাক|অর্ডার.*কোথায়/i;
const DELIVERY_RE = /\b(delivery|shipping|ship|courier|deliver|pathan|pathabo)\b|ডেলিভারি|কুরিয়ার/i;
const PAYMENT_RE = /\b(payment|pay|bkash|bikash|nagad|rocket|bank|cod|cash on delivery|transaction|trxid|credit card|debit card)\b|পেমেন্ট|বিকাশ|নগদ|রকেট|ব্যাংক/i;
const WARRANTY_RE = /\b(warranty|guarantee|goranti|warenty)\b|ওয়ারেন্টি|গ্যারান্টি/i;
const RETURN_RE = /\b(return|refund|replace|exchange|ferot|wapai|money back)\b|রিটার্ন|রিফান্ড|ফেরত/i;
const CANCEL_RE = /\b(cancel|change my order|modify my order)\b|বাতিল/i;
const OFFERS_RE = /\b(offer|discount|deal|sale|coupon|promo|combo|package)\b|অফার|ডিসকাউন্ট/i;
const DEALER_RE = /\b(dealer|partner|reseller|wholesale|bulk|b2b|minimum order|moq|dealer hote|partner hote)\b|ডিলার|পার্টনার|পাইকারি/i;
const CONTACT_RE = /\b(contact|hotline|phone|mobile|email|address|location|showroom|where are you|kothay|shop kothay|office)\b|যোগাযোগ|ঠিকানা|দোকান|হটলাইন|ইমেইল|কোথায়/i;
const ABOUT_RE = /\b(about|who are you|what is mizan|company|mizan trade ki|ki koren|authorized|distributor)\b|সম্পর্কে|প্রতিষ্ঠান/i;
const GENUINE_RE = /\b(genuine|original|authentic|fake|counterfeit)\b|আসল|নকল/i;
const ORDER_RE = /\b(order|checkout|kinbo|buy|purchase|order korte|order korbo)\b|অর্ডার|কিনব|কিনতে/i;
const CATEGORY_LIST_RE = /\b(ki ki|kon kon|list of|all product|all category|product list|category list|brand list|price list)\b|what (products|product categories|categories|brands?) (do|are|have)|which (products|categories|brands?)|products? (do you|you) (sell|have)|কি কি|কোন কোন/i;
const COMPARE_RE = /\b(compare|comparison|vs|versus|difference|better|which one|konta|kontar)\b|তুলনা|ভালো/i;
const PRICE_WORD_RE = /\b(price|dam|daam|cost|rate|how much|taka|tk|budget|cheap|kom dam)\b|দাম|মূল্য|কত|টাকা/i;
const STOCK_WORD_RE = /\b(stock|available|availability|ache|achhe|ase|achhey|nai|nei|in stock|out of stock|pre order|coming soon)\b|স্টক|আছে|নেই/i;
const SITE_BLOCK_RE = /\b(delivery|shipping|courier|payment|bkash|nagad|rocket|bank|cod|contact|hotline|address|showroom|order|dealer|partner|wholesale|offer|discount|refund|return)\b|ডেলিভারি|পেমেন্ট|যোগাযোগ|অর্ডার|ডিলার|অফার/i;

function hasBengali(text) {
    return /[\u0980-\u09FF]/.test(String(text || ""));
}

/* ---------- main ---------- */

async function generateReply(text, options) {
    const raw = String(text || "").trim().slice(0, 2000);
    const opts = options || {};
    const history = Array.isArray(opts.history) ? opts.history : [];
    const state = normalizedState(opts.state);

    if (!raw) {
        return {
            reply: "Please type your question and I will help.",
            handoff: false,
            intent: "empty",
            confidence: "low",
            state: state
        };
    }

    const k = await getKnowledge();
    const q = buildQuery(raw);
    const n = q.norm;

    function result(intent, reply, confidence, extra) {
        return Object.assign({
            reply: reply,
            handoff: false,
            intent: intent,
            confidence: confidence,
            state: state,
            items: [],
            faq: null,
            category: q.category,
            brand: q.brand
        }, extra || {});
    }

    /* 1. Human handoff */
    if (HANDOFF_RE.test(n)) {
        return result("handoff",
            "Sure — I'm connecting you to our team. Please write your question here; a team member will reply in this chat. " +
            "For urgent help call " + (siteConfig.hotline || "+8801709967815") + ". " +
            "The assistant will stay quiet until the team hands the chat back.",
            "high", { handoff: true });
    }

    /* 2. AI assistant (ChatGPT-like) when an API key is configured.
          It receives the matched products, FAQs and the full store brief,
          and mirrors the customer's language. The rule engine below stays
          as the no-key and AI-failure fallback. */
    if (isAiConfigured()) {
        const aiItems = hasProductSubject(q) ? searchProducts(k, q) : [];
        const aiFaqHit = findFaq(k, q);

        const ai = await askAi({
            message: raw,
            history: history,
            context: buildAiContext(k, q, {
                items: aiItems,
                faq: aiFaqHit ? aiFaqHit.faq : null
            }, state)
        });

        if (ai) {
            return result("ai", cleanAiText(ai), "medium", {
                source: "ai",
                items: aiItems.slice(0, 5),
                faq: aiFaqHit ? aiFaqHit.faq : null,
                state: aiItems.length
                    ? nextState(state, "ai", aiItems, q.category)
                    : state
            });
        }

        /* AI unreachable (timeout/error) — fall through to the rule engine. */
    }

    /* 3. Greetings and small talk */
    if (GREETING_RE.test(n) && raw.length <= 40 && q.tokens.length <= 1 && !hasProductSubject(q) && !SITE_BLOCK_RE.test(n)) {
        return result("greeting",
            "Hello! I'm the MizanTrade assistant. I can help with:\n" +
            "• Products, prices and stock\n" +
            "• Delivery charges and timing\n" +
            "• Payment, warranty and order tracking\n\n" +
            "Ask me anything — for example: \"Do you have a 1TB NVMe SSD?\" or \"bKash number?\"",
            "high");
    }

    if (THANKS_RE.test(n) && raw.length <= 40 && !hasProductSubject(q)) {
        return result("thanks",
            "You're welcome! If you need anything else — product price, stock, delivery or warranty — just ask.",
            "high");
    }

    if (BYE_RE.test(n) && raw.length <= 40) {
        return result("bye",
            "Thank you for visiting Mizan Trade. If you need help later, message us here or call " +
            (siteConfig.hotline || "+8801709967815") + ".",
            "high");
    }

    /* 3. Follow-up about the products just shown */
    const follow = detectFollowUp(q);
    if (follow.is && state.lastProducts.length) {
        const answer = followUpAnswer(k, q, state);
        if (answer) {
            const intent = followUpKind(n);
            return result("followup_" + intent, answer, "high", {
                state: nextState(state, "followup_" + intent, [], q.category)
            });
        }
    }

    if (follow.is && !state.lastProducts.length && !hasProductSubject(q)) {
        if (WARRANTY_RE.test(n)) {
            return result("warranty", warrantyAnswer(null), "high");
        }
        if (COMPARE_RE.test(n)) {
            return result("compare",
                "Send two model names to compare, for example:\n\"compare KingSpec 1TB NVMe SSD vs AITC 512GB SATA SSD\".",
                "high");
        }
    }

    /* 4. Order tracking */
    if (ORDER_TRACK_RE.test(n)) {
        return result("order_tracking", orderTrackAnswer(), "high");
    }

    /* 5. Delivery */
    if (DELIVERY_RE.test(n)) {
        return result("delivery", deliveryAnswer(), "high");
    }

    /* 6. Payment */
    if (PAYMENT_RE.test(n)) {
        return result("payment", paymentAnswer(), "high");
    }

    /* 7. Warranty */
    if (WARRANTY_RE.test(n)) {
        let product = null;
        if (hasProductSubject(q)) {
            const found = searchProducts(k, q)[0];
            if (found) product = found.product;
        }
        return result("warranty", warrantyAnswer(product), "high",
            product ? { items: [{ product: product, score: 0 }] } : {});
    }

    /* 8. Returns, refunds, cancellation */
    if (RETURN_RE.test(n)) {
        return result("return", returnAnswer(), "high");
    }

    if (CANCEL_RE.test(n)) {
        return result("cancel", cancelAnswer(k), "high");
    }

    /* 9. Offers and discounts */
    if (OFFERS_RE.test(n)) {
        return result("offers", offersAnswer(), "high");
    }

    /* 10. Dealer / wholesale */
    if (DEALER_RE.test(n)) {
        return result("dealer", dealerAnswer(), "high");
    }

    /* 11. Contact details */
    if (CONTACT_RE.test(n)) {
        return result("contact", contactAnswer(), "high");
    }

    /* 12. About and authenticity */
    if (GENUINE_RE.test(n)) {
        return result("genuine", genuineAnswer(), "high");
    }

    if (ABOUT_RE.test(n)) {
        return result("about", aboutAnswer(), "high");
    }

    /* 13. Catalogue overview */
    if (CATEGORY_LIST_RE.test(n) && !hasProductSubject(q)) {
        return result("category_list", categoryOverview(k, n), "high");
    }

    /* 14. Compare */
    if (COMPARE_RE.test(n)) {
        const reply = compareFromMessage(k, q, state);
        const items = state.lastProducts.length >= 2
            ? []
            : searchProducts(k, q).slice(0, 2);
        return result("compare", reply, "medium", { items: items });
    }

    /* 15. Price/stock question without a product */
    if ((PRICE_WORD_RE.test(n) || STOCK_WORD_RE.test(n)) && !hasProductSubject(q)) {
        return result("need_product", askWhichProduct(), "medium");
    }

    /* 16. Product search */
    if (hasProductSubject(q)) {
        const items = searchProducts(k, q);

        if (!items.length) {
            return result("catalog_empty", noProductAnswer(k, q), "medium", {
                state: nextState(state, "catalog_empty", [], q.category)
            });
        }

        return result("catalog", productSearchAnswer(k, q, items), "high", {
            items: items,
            state: nextState(state, "catalog", items, q.category)
        });
    }

    /* 17. Ordering help */
    if (ORDER_RE.test(n)) {
        return result("order", orderAnswer(), "high");
    }

    /* 18. FAQ */
    const foundFaq = findFaq(k, q);
    if (foundFaq) {
        return result("faq", faqAnswer(foundFaq.faq), "high", { faq: foundFaq.faq });
    }

    /* 19. Fallback (also used when the AI assistant is configured but unreachable) */
    return result("fallback",
        "I can help with:\n" +
        "• Products, prices and stock — try \"Do you have a 1TB NVMe SSD?\"\n" +
        "• Delivery, payment, warranty and order tracking\n" +
        "• Dealer/partner registration\n\n" +
        "Type \"agent\" to connect with our team, or call " +
        (siteConfig.hotline || "+8801709967815") + ".",
        "low");
}

module.exports = {
    generateReply
};
