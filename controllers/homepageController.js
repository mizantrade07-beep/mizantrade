const Category = require("../models/Category");
const { getHomeContent, migrateLegacySections } = require("../utils/homeContent");

function str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function isActive(value) {
    return value === true || value === "on" || value === "true" || value === "1";
}

function num(value, def, min, max) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = def;
    if (n < min) n = min;
    if (n > max) n = max;
    return Math.round(n);
}

function color(value) {
    const c = str(value);
    return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "";
}

function normSlides(arr) {
    return (arr || [])
        .map(function (r) {
            return {
                tag: str(r.tag),
                title: str(r.title),
                text: str(r.text),
                buttonText: str(r.buttonText),
                buttonLink: str(r.buttonLink),
                image: str(r.image),
                overlay: num(r.overlay, 75, 0, 100),
                height: num(r.height, 0, 0, 800),
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.title || r.image; });
}

function normSideCards(arr) {
    return (arr || [])
        .map(function (r) {
            return {
                icon: str(r.icon),
                title: str(r.title),
                text: str(r.text),
                linkText: str(r.linkText),
                link: str(r.link),
                bgColor: color(r.bgColor),
                image: str(r.image),
                overlay: num(r.overlay, 62, 0, 100),
                height: num(r.height, 0, 0, 800),
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.icon || r.title || r.text || r.image; });
}

function normWhyItems(arr) {
    return (arr || [])
        .map(function (r) {
            return {
                icon: str(r.icon),
                title: str(r.title),
                text: str(r.text),
                link: str(r.link)
            };
        })
        .filter(function (r) { return r.icon || r.title || r.text; });
}

const KINDS = ["latest", "custom", "upcoming", "preorder", "new", "stockout"];
const SCOPES = ["all", "category", "subcategory", "childcategory", "brand", "products"];
const SLOTS = [
    "after-hero",
    "after-featured",
    "after-latest",
    "after-custom",
    "after-upcoming",
    "after-preorder",
    "after-new",
    "after-stockout",
    "before-footer"
];

function normProductSections(arr) {
    return (arr || [])
        .map(function (r) {
            const kind = KINDS.indexOf(str(r.kind)) !== -1 ? str(r.kind) : "custom";
            const scope = SCOPES.indexOf(str(r.scope)) !== -1 ? str(r.scope) : "all";
            return {
                kind: kind,
                title: str(r.title),
                icon: str(r.icon),
                scope: scope,
                categorySlug: str(r.categorySlug),
                brand: str(r.brand),
                products: str(r.products),
                count: num(r.count, 10, 2, 24),
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.title; });
}

function normImageSections(arr) {
    return (arr || [])
        .map(function (r) {
            const slot = SLOTS.indexOf(str(r.slot)) !== -1 ? str(r.slot) : "after-custom";
            const kind = str(r.kind) === "video" ? "video" : "image";
            return {
                kind: kind,
                image: str(r.image),
                video: str(r.video),
                link: str(r.link),
                alt: str(r.alt),
                slot: slot,
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.image || r.video; });
}

function normLogos(arr) {
    return (arr || [])
        .map(function (r) {
            return {
                name: str(r.name),
                image: str(r.image),
                link: str(r.link),
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.name || r.image; });
}

function normSlugs(value) {
    if (Array.isArray(value)) {
        return value.map(str).filter(Boolean);
    }
    const one = str(value);
    return one ? [one] : [];
}

/* মেইন/সাব ক্যাটাগরি তালিকা (ফিচার্ড-ক্যাটাগরি পিকার ও স্কোপ ড্রপডাউনের জন্য) */
async function categoryLists() {
    const all = await Category.find({}).sort({ order: 1, name: 1 }).lean();
    const bySlug = {};
    all.forEach(function (c) { bySlug[c.slug] = c; });

    function levelOf(c) {
        let lvl = 0;
        let guard = 0;
        let cur = c;
        while (cur && cur.parent && bySlug[cur.parent] && guard < 5) {
            lvl += 1;
            cur = bySlug[cur.parent];
            guard += 1;
        }
        return lvl;
    }

    const parentCats = all.filter(function (c) { return levelOf(c) === 0; });
    const subCats = all.filter(function (c) { return levelOf(c) === 1; });
    const childCats = all.filter(function (c) { return levelOf(c) === 2; });

    return { parentCats, subCats, childCats };
}

/* ======================================================
   ADMIN - HOMEPAGE CONTENT MANAGER (GET)
====================================================== */

exports.getHomepage = async (req, res) => {
    try {
        const [content, cats] = await Promise.all([
            getHomeContent(),
            categoryLists()
        ]);

        const view = content.toObject();
        // পুরোনো ডকুমেন্টে productSections না থাকলে লেগাসি সেকশন দেখাই
        if (!view.productSections.length && (view.customSections || []).length) {
            view.productSections = migrateLegacySections(view);
        }

        return res.render("admin/homepage", {
            pageTitle: "Homepage Content",
            content: view,
            parentCats: cats.parentCats,
            subCats: cats.subCats,
            childCats: cats.childCats,
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getHomepage error:", error.message);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - SAVE HOMEPAGE CONTENT (POST)
====================================================== */

exports.postUpdateHomepage = async (req, res) => {
    try {
        const body = req.body || {};
        const content = await getHomeContent();

        content.heroSideWidth = num(body.heroSideWidth, 0, 0, 600);

        content.heroSlides = normSlides(body.heroSlides);
        content.heroSideCards = normSideCards(body.heroSideCards);

        content.whyTitle = str(body.whyTitle);
        content.whySubtitle = str(body.whySubtitle);
        content.whyDescription = str(body.whyDescription);
        content.whyItems = normWhyItems(body.whyItems);

        content.featEnabled = isActive(body.featEnabled);
        content.featTitle = str(body.featTitle);
        content.featSubtitle = str(body.featSubtitle);
        content.featDescription = str(body.featDescription);
        content.featSlugs = normSlugs(body.featSlugs);

        content.productSections = normProductSections(body.productSections);
        content.imageSections = normImageSections(body.imageSections);

        content.brandSectionTitle = str(body.brandSectionTitle);
        content.brandLogos = normLogos(body.brandLogos);

        // পুরোনো customSections ফিল্ড আর ব্যবহার হয় না — সেকশন এখন productSections
        content.customSections = [];

        await content.save();

        return res.redirect("/admin/homepage?message=saved");
    } catch (error) {
        console.error("postUpdateHomepage error:", error.message);
        return res.redirect("/admin/homepage?message=error");
    }
};
