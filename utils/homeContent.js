const HomeContent = require("../models/HomeContent");

/* Fallbacks mirror the original hardcoded homepage so the site keeps its
   content until the admin customises it. */
const DEFAULTS = {
    latestProductsCount: 24,
    heroSlides: [
        {
            tag: "Authorized Distributor",
            title: "Your Trusted Wholesale Partner for Computer Components",
            text: "Motherboard, SSD, Desktop RAM, Laptop RAM and Graphics Card — at dealer prices, directly from the importer.",
            buttonText: "Browse All Products",
            buttonLink: "/shop",
            image: "",
            height: 0,
            active: true
        },
        {
            tag: "Dealer Wholesale",
            title: "Best Wholesale Prices for Your Shop",
            text: "Registered dealers get special discounts. Fill out the Become a Partner form today and join our network.",
            buttonText: "Become a Partner",
            buttonLink: "/become-a-partner",
            image: "",
            height: 0,
            active: true
        },
        {
            tag: "Official Brands",
            title: "KingSpec • AITC Kingsman • Xentrha • Unika • PowerSync",
            text: 'All products are 100% original and come with official warranty. Verify the "AUTHORIZED PRODUCT – Powered by MIZAN TRADE" sticker.',
            buttonText: "Shop SSD",
            buttonLink: "/category/ssd",
            image: "",
            height: 0,
            active: true
        }
    ],
    heroSideCards: [
        {
            icon: "fa-solid fa-headset",
            title: "Hotline Support",
            text: "Call us directly for any product or order-related information.",
            linkText: "",
            link: "",
            bgColor: "",
            image: "",
            height: 0,
            active: true
        },
        {
            icon: "fa-solid fa-truck-fast",
            title: "Fast Delivery",
            text: "Delivery within 24 hours inside Dhaka and 48-72 hours outside Dhaka.",
            linkText: "",
            link: "",
            bgColor: "",
            image: "",
            height: 0,
            active: true
        }
    ],
    whyTitle: "Why choose us?",
    whySubtitle: "Quality products, fast service, and guaranteed reliability.",
    whyDescription: "",
    whyItems: [
        {
            icon: "fa-solid fa-shield-halved",
            title: "Genuine Products",
            text: "We ensure 100% authentic and quality-checked products directly from trusted sources",
            link: "/page/genuine-products"
        },
        {
            icon: "fa-solid fa-handshake",
            title: "Easy Business Process",
            text: "Simple ordering, fast delivery, and smooth communication for your business.",
            link: "/page/easy-business-process"
        },
        {
            icon: "fa-solid fa-atom",
            title: "Trusted Distribution Network",
            text: "Strong supply chain ensuring timely delivery across all locations.",
            link: "/page/trusted-distribution-network"
        },
        {
            icon: "fa-solid fa-arrows-rotate",
            title: "Replacement Warranty",
            text: "Hassle-free replacement guarantee for damaged or defective items.",
            link: "/page/replacement-warranty"
        }
    ],
    featEnabled: true,
    featTitle: "Featured Category",
    featSubtitle: "Get Your Desired Product from Featured Category!",
    featDescription: "",
    featSlugs: [],
    brandSectionTitle: "Our Brands",
    brandLogos: [
        { name: "KINGSPEC", image: "", link: "", active: true },
        { name: "AITC KINGSMAN GAMING", image: "", link: "", active: true },
        { name: "XENTRHA", image: "", link: "", active: true },
        { name: "UNIKA", image: "", link: "", active: true },
        { name: "POWERSYNC", image: "", link: "", active: true }
    ],
    imageSections: [],
    productSections: [
        {
            kind: "latest",
            title: "Latest Products",
            icon: "fa-solid fa-bolt",
            scope: "all",
            categorySlug: "",
            brand: "",
            products: "",
            count: 24,
            active: true
        },
        {
            kind: "custom",
            title: "Latest KingSpec Products",
            icon: "",
            scope: "brand",
            categorySlug: "",
            brand: "KingSpec",
            products: "",
            count: 10,
            active: true
        },
        {
            kind: "custom",
            title: "AITC Kingsman Gaming",
            icon: "",
            scope: "brand",
            categorySlug: "",
            brand: "AITC Kingsman Gaming",
            products: "",
            count: 10,
            active: true
        },
        {
            kind: "custom",
            title: "Latest Xentrha Products",
            icon: "",
            scope: "brand",
            categorySlug: "",
            brand: "Xentrha",
            products: "",
            count: 10,
            active: true
        },
        {
            kind: "custom",
            title: "Latest UNIKA Products",
            icon: "",
            scope: "brand",
            categorySlug: "",
            brand: "UNIKA",
            products: "",
            count: 10,
            active: true
        }
    ]
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

/* পুরোনো customSections (source: brand/category/latest) → নতুন productSections */
function migrateLegacySections(doc) {
    const legacy = (doc && doc.customSections) || [];
    if (!legacy.length) return [];

    return legacy.map(function (s) {
        const scope =
            s.source === "brand"
                ? "brand"
                : s.source === "category"
                    ? "category"
                    : "all";

        return {
            kind: "custom",
            title: s.title || "",
            icon: "",
            scope: scope,
            categorySlug: scope === "category" ? s.sourceName || "" : "",
            brand: scope === "brand" ? s.sourceName || "" : "",
            products: "",
            count: s.count || 10,
            active: s.active !== false
        };
    });
}

/* One-time seed for documents created before side cards / the Latest
   section existed. The seedVersion marker keeps later deletions permanent. */
async function seedOnce(doc) {
    if (doc.seedVersion) return doc;

    const claimed = await HomeContent.findOneAndUpdate(
        { _id: doc._id, seedVersion: { $ne: 1 } },
        { $set: { seedVersion: 1 } },
        { new: true }
    );

    if (!claimed) {
        return (await HomeContent.findById(doc._id)) || doc;
    }

    let changed = false;

    if (!(claimed.heroSideCards || []).length) {
        claimed.heroSideCards = clone(DEFAULTS.heroSideCards);
        changed = true;
    }

    if (!(claimed.productSections || []).length && (claimed.customSections || []).length) {
        claimed.productSections = migrateLegacySections(claimed);
        changed = true;
    }

    const hasLatest = (claimed.productSections || []).some(function (s) {
        return s.kind === "latest";
    });
    if (!hasLatest) {
        claimed.productSections.unshift({
            kind: "latest",
            title: "Latest Products",
            icon: "fa-solid fa-bolt",
            scope: "all",
            categorySlug: "",
            brand: "",
            products: "",
            count: Math.min(Math.max(Number(claimed.latestProductsCount) || 24, 2), 24),
            active: true
        });
        changed = true;
    }

    if (changed) await claimed.save();
    return claimed;
}

/* Returns the singleton doc, creating it with defaults on first use. */
async function getHomeContent() {
    let doc = await HomeContent.findOne({});
    if (!doc) {
        doc = await HomeContent.create(clone(DEFAULTS));
    }
    return seedOnce(doc);
}

/* Values the views should render: stored content, falling back to defaults
   where a section is still empty. */
function effective(doc) {
    const d = doc || {};
    const activeSlides = (d.heroSlides || []).filter(function (s) {
        return s.active !== false && (s.tag || s.title || s.text || s.buttonText || s.image);
    });
    const activeSideCards = (d.heroSideCards || []).filter(function (s) {
        return s.active !== false && (s.icon || s.title || s.text || s.image);
    });
    const whyItems = (d.whyItems || []).filter(function (i) { return i.icon || i.title || i.text; });

    let sections = (d.productSections || []).filter(function (s) {
        return s.active !== false && (s.title || s.brand || s.categorySlug || s.products);
    });
    if (!sections.length) sections = migrateLegacySections(d);

    const activeBrands = (d.brandLogos || []).filter(function (b) { return b.active !== false && (b.image || b.name); });
    const activeImages = (d.imageSections || []).filter(function (i) { return i.active !== false && (i.image || i.video); });

    return {
        latestProductsCount: Number(d.latestProductsCount) || DEFAULTS.latestProductsCount,
        heroSlides: activeSlides,
        heroSideWidth: Number(d.heroSideWidth) || 0,
        heroSideCards: activeSideCards,
        whyTitle: d.whyTitle || "",
        whySubtitle: d.whySubtitle || "",
        whyDescription: d.whyDescription || "",
        whyItems: whyItems,
        featEnabled: d.featEnabled !== false,
        featTitle: d.featTitle || "",
        featSubtitle: d.featSubtitle || "",
        featDescription: d.featDescription || "",
        featSlugs: d.featSlugs || [],
        productSections: sections,
        imageSections: activeImages,
        brandSectionTitle: d.brandSectionTitle || "",
        brandLogos: activeBrands
    };
}

module.exports = {
    HomeContent,
    DEFAULTS,
    getHomeContent,
    effective,
    migrateLegacySections,
    clone
};
