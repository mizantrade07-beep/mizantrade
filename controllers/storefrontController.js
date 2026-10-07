const Product = require("../models/Product");
const Category = require("../models/Category");
const { collectFamilyNames } = require("../utils/categoryTree");
const { buildSeo, baseUrl } = require("../utils/seo");
const siteConfig = require("../config/site");

const PRODUCTS_PER_PAGE = 12;

/* একটি ক্যাটাগরি (slug/name) + তার সব বংশধরের প্রোডাক্ট মেলানোর ফিল্টার */
function categoryMatchFilter(names) {
    return {
        $or: [
            { mainCategory: { $in: names } },
            { subCategory: { $in: names } },
            { childCategory: { $in: names } }
        ]
    };
}

/* ======================================================
   HOME PAGE
====================================================== */

exports.getHome = async (req, res) => {
    try {
        const [homeCategories, allCategories] = await Promise.all([
            Category.find({ isActive: true, showOnHome: true })
                .sort({ order: 1, name: 1 })
                .lean(),
            Category.find({}).lean()
        ]);

        // প্রতিটি হোম-ক্যাটাগরির প্রোডাক্ট একসাথে লোড
        const sections = [];

        for (const category of homeCategories) {
            const names = collectFamilyNames(allCategories, category.slug);

            const products = await Product.find(
                Object.assign({ isActive: true }, categoryMatchFilter(names))
            )
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            sections.push({ category, products });
        }

        const latestProducts = await Product.find({ isActive: true })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        res.locals.seo = buildSeo({
            title: "Mizan Trade - Computer Components Distributor in Bangladesh",
            description: "মিজান ট্রেড — বাংলাদেশে কম্পিউটার কম্পোনেন্ট ও হার্ডওয়্যার পাইকারি বিতরণকারী। SSD, RAM, Motherboard, Processor, Laptop ও এক্সেসরিজ সেরা দামে।",
            keywords: "computer components bd, pc hardware bangladesh, ssd price bd, ram price bd, motherboard bd",
            path: "/",
            image: "/images/logo.svg",
            jsonLd: {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: siteConfig.siteName,
                url: baseUrl(),
                logo: baseUrl() + "/images/logo.svg",
                contactPoint: {
                    "@type": "ContactPoint",
                    telephone: siteConfig.hotline,
                    contactType: "customer service",
                    areaServed: "BD",
                    availableLanguage: ["en", "bn"]
                }
            }
        });

        return res.render("index", {
            pageTitle: "Mizan Trade - Computer Components Distributor in Bangladesh",
            sections,
            latestProducts
        });
    } catch (error) {
        console.error("Home page error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   SHOP / CATEGORY PAGE (search, filter, sort, pagination)
====================================================== */

async function renderShop(req, res, extraFilter, pageTitle) {
    const {
        search = "",
        brand = "",
        sort = "latest",
        page = 1
    } = req.query;

    const min = req.query.min !== undefined && req.query.min !== ""
        ? Number(req.query.min)
        : null;

    const max = req.query.max !== undefined && req.query.max !== ""
        ? Number(req.query.max)
        : null;

    const inStock = req.query.stock === "1";

    // Brand may arrive as a single value or repeated checkboxes (array).
    // Products keep their brand either in `brand` or as a "Brand" spec pair,
    // so match against both.
    const brandList = []
        .concat(req.query.brand || [])
        .map(function (b) { return String(b).trim(); })
        .filter(Boolean);

    // Spec/attribute filters arrive as repeated "spec=key::value" params.
    const specSel = []
        .concat(req.query.spec || [])
        .map(function (s) { return String(s); })
        .filter(function (s) { return s.indexOf("::") > -1; });

    const conditions = [{ isActive: true }];

    if (extraFilter) {
        conditions.push(extraFilter);
    }

    if (search.trim()) {
        const regex = new RegExp(
            search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i"
        );

        conditions.push({
            $or: [
                { title: regex },
                { brand: regex },
                { sku: regex },
                { shortDesc: regex }
            ]
        });
    }

    if (brandList.length > 0) {
        const brandOr = brandList.map(function (b) {
            const re = new RegExp(
                "^" + b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                "i"
            );
            return {
                $or: [
                    { brand: re },
                    { specs: { $elemMatch: { key: /^brand$/i, value: re } } }
                ]
            };
        });
        conditions.push(brandOr.length === 1 ? brandOr[0] : { $or: brandOr });
    }

    // Each selected spec must exist as a matching key/value pair on the product.
    specSel.forEach(function (s) {
        const idx = s.indexOf("::");
        const key = s.slice(0, idx).trim();
        const value = s.slice(idx + 2).trim();
        if (!key || !value) return;
        conditions.push({
            specs: {
                $elemMatch: {
                    key: new RegExp(
                        "^" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                        "i"
                    ),
                    value: new RegExp(
                        "^" + value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                        "i"
                    )
                }
            }
        });
    });

    if (inStock) {
        conditions.push({ stockStatus: "In Stock" });
    }

    if (
        (min !== null && !Number.isNaN(min)) ||
        (max !== null && !Number.isNaN(max))
    ) {
        const priceConditions = [];

        if (min !== null && !Number.isNaN(min)) {
            priceConditions.push({ $gte: ["$$price", min] });
        }

        if (max !== null && !Number.isNaN(max)) {
            priceConditions.push({ $lte: ["$$price", max] });
        }

        conditions.push({
            $expr: {
                $let: {
                    vars: {
                        price: { $ifNull: ["$salePrice", "$regularPrice"] }
                    },
                    in: { $and: priceConditions }
                }
            }
        });
    }

    const filter = conditions.length === 1
        ? conditions[0]
        : { $and: conditions };

    const sortMap = {
        latest: { createdAt: -1 },
        price_asc: { salePrice: 1, regularPrice: 1 },
        price_desc: { salePrice: -1, regularPrice: -1 },
        name_asc: { title: 1 }
    };

    const currentPage = Math.max(1, Number(page) || 1);
    const skip = (currentPage - 1) * PRODUCTS_PER_PAGE;

    // Brands must be scoped to the active category so one category's brands
    // never leak into another category's sidebar.
    const brandQuery = { isActive: true, brand: { $ne: "" } };
    if (extraFilter) {
        brandQuery.$and = [extraFilter];
    }

    const [products, total, brands, facetDocs] = await Promise.all([
        Product.find(filter)
            .sort(sortMap[sort] || sortMap.latest)
            .skip(skip)
            .limit(PRODUCTS_PER_PAGE)
            .lean(),
        Product.countDocuments(filter),
        Product.distinct("brand", brandQuery),
        // Facets are computed from the category scope only (ignoring the
        // currently-selected brand/spec filters) so options stay toggleable.
        Product.find(
            extraFilter ? { $and: [{ isActive: true }, extraFilter] } : { isActive: true }
        ).select("specs").lean()
    ]);

    const totalPages = Math.ceil(total / PRODUCTS_PER_PAGE);

    // Build ordered spec facets: key -> unique values in first-seen order.
    const facetMap = new Map();
    facetDocs.forEach(function (doc) {
        (doc.specs || []).forEach(function (sp) {
            const k = String(sp.key || "").trim();
            const v = String(sp.value || "").trim();
            if (!k || !v) return;
            if (!facetMap.has(k)) facetMap.set(k, []);
            const arr = facetMap.get(k);
            if (arr.indexOf(v) === -1) arr.push(v);
        });
    });
    const specFacets = [];
    facetMap.forEach(function (values, key) {
        specFacets.push({ key: key, values: values });
    });

    res.locals.seo = buildSeo({
        title: pageTitle,
        description: "মিজান ট্রেডে কম্পিউটার কম্পোনেন্ট ও হার্ডওয়্যার কিনুন — SSD, RAM, Motherboard, Processor, Laptop, Monitor ও এক্সেসরিজ সেরা দামে।",
        path: req.path,
        type: "website"
    });

    return res.render("shop", {
        pageTitle,
        products,
        total,
        currentPage,
        totalPages,
        search: search.trim(),
        brand: brandList,
        sort,
        min: min !== null && !Number.isNaN(min) ? min : "",
        max: max !== null && !Number.isNaN(max) ? max : "",
        inStock,
        catSlug: String(req.query.cat || req.params.slug || "").trim(),
        brands: brands.sort(),
        specFacets: specFacets,
        specSel: specSel,
        activeCategory: String(req.query.cat || req.params.slug || "").trim()
    });
}

exports.getShop = async (req, res) => {
    try {
        const cat = String(req.query.cat || "").trim();

        if (cat) {
            // ক্যাটাগরি + তার সব সাব/চাইল্ডের প্রোডাক্টও দেখাবে
            const [allCategories, category] = await Promise.all([
                Category.find({}).lean(),
                Category.findOne({ slug: cat }).lean()
            ]);

            const names = collectFamilyNames(allCategories, cat);
            const extraFilter = categoryMatchFilter(names);

            return renderShop(req, res, extraFilter, category ? category.name + " - Mizan Trade" : "Shop");
        }

        return renderShop(req, res, null, "Shop - Mizan Trade");
    } catch (error) {
        console.error("Shop page error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.getCategoryPage = async (req, res) => {
    try {
        const category = await Category.findOne({
            slug: req.params.slug,
            isActive: true
        }).lean();

        if (!category) {
            return res.status(404).render("errors/404");
        }

        const allCategories = await Category.find({}).lean();
        const names = collectFamilyNames(allCategories, category.slug);
        const extraFilter = categoryMatchFilter(names);

        return renderShop(
            req,
            res,
            extraFilter,
            category.name + " - Mizan Trade"
        );
    } catch (error) {
        console.error("Category page error:", error);
        return res.status(500).render("errors/500");
    }
};
