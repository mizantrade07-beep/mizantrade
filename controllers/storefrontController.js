const mongoose = require("mongoose");

const Product = require("../models/Product");
const Offer = require("../models/Offer");
const Category = require("../models/Category");
const { collectFamilyPaths, categoryTrail } = require("../utils/categoryTree");
const { offerTypeIcon, offerPriceLabel } = require("../utils/offers");
const { buildSeo, baseUrl } = require("../utils/seo");
const siteConfig = require("../config/site");
const { getHomeContent, effective } = require("../utils/homeContent");
const { setTransform: optimizeImage } = require("../utils/images");
const cache = require("../utils/cache");
const siteData = require("../middleware/siteData");

const PRODUCTS_PER_PAGE = 12;
const HOME_CACHE_MS = 120 * 1000;

/* একটি ক্যাটাগরি (slug/name) + তার সব বংশধরের প্রোডাক্ট মেলানোর ফিল্টার */
function categoryMatchFilter(paths) {
    const or = (paths || [])
        .map(function (p) {
            const cond = {};
            if (p.main) cond.mainCategory = p.main;
            if (p.level >= 2 && p.sub) cond.subCategory = p.sub;
            if (p.level >= 3 && p.child) cond.childCategory = p.child;
            return cond;
        })
        .filter(function (c) {
            return Object.keys(c).length > 0;
        });

    if (or.length === 0) {
        return { _id: null };
    }
    if (or.length === 1) {
        return or[0];
    }
    return { $or: or };
}

/* Escape user input for use inside a RegExp. */
function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Brand values saved in older CMS rows sometimes look like
   "KingSpec - Product" or "Xenthra, Unika - Product". Keep only real
   brand names so a saved section always finds its products. */
function brandNames(value) {
    return String(value || "")
        .split(",")
        .map(function (s) {
            return s.replace(/\s*-\s*product\s*$/i, "").trim();
        })
        .filter(Boolean);
}

function brandMatchFilter(value) {
    const names = brandNames(value);
    if (!names.length) return null;

    const or = [];
    names.forEach(function (name) {
        const re = new RegExp("^" + escapeRegex(name) + "$", "i");
        or.push({ brand: re });
        or.push({ specs: { $elemMatch: { key: /^brand$/i, value: re } } });
    });
    return or.length === 1 ? or[0] : { $or: or };
}

/* Live search suggestions for the header dropdown. Returns real products
   (with mainImage) and matching categories. */
exports.searchSuggestions = async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();

        if (q.length < 2) {
            return res.json({ products: [], categories: [] });
        }

        const rx = new RegExp(escapeRegex(q), "i");

        const [products, categories] = await Promise.all([
            Product.find({
                isActive: true,
                $or: [
                    { title: rx },
                    { brand: rx },
                    { sku: rx }
                ]
            })
                .sort({ stockRank: 1, createdAt: -1 })
                .limit(8)
                .select("title slug brand mainImage salePrice regularPrice callForPrice")
                .lean(),

            Category.find({ isActive: true, name: rx })
                .sort({ order: 1, name: 1 })
                .limit(5)
                .select("name slug icon")
                .lean()
        ]);

        const shapedProducts = products.map(function (p) {
            let price;
            if (p.callForPrice) {
                price = "Call for price";
            } else {
                const value = p.salePrice || p.regularPrice || 0;
                price = "৳ " + Number(value).toLocaleString("en-US");
            }

            return {
                name: p.title,
                slug: p.slug,
                price: price,
                image: optimizeImage(p.mainImage, 160) || "/images/default-product.png"
            };
        });

        const shapedCategories = categories.map(function (c) {
            return {
                name: c.name,
                slug: c.slug,
                icon: c.icon || "fa-solid fa-folder"
            };
        });

        return res.json({
            products: shapedProducts,
            categories: shapedCategories
        });
    } catch (error) {
        console.error("searchSuggestions error:", error.message);
        return res.json({ products: [], categories: [] });
    }
};

/* ======================================================
   HOME PAGE
====================================================== */

/* Builds everything the homepage needs (sections, featured categories and
   image slots). Product section queries run in parallel and the whole result
   is cached for HOME_CACHE_MS, so repeated homepage hits cost zero DB work. */
async function buildHomePayload(allCategories) {
    const homeDoc = await getHomeContent();
    const home = effective(homeDoc);

    /* ---------- প্রোডাক্ট সেকশন (সংরক্ষিত ক্রমেই রেন্ডার হয়) ---------- */
    const KIND_BASE = {
        latest: {},
        custom: {},
        upcoming: { stockStatus: "Coming Soon" },
        preorder: { stockStatus: "Pre Order" },
        new: { isNewArrival: true },
        stockout: { stockStatus: "Out of Stock" }
    };
    const KIND_ICON = {
        latest: "fa-solid fa-bolt",
        custom: "fa-solid fa-layer-group",
        upcoming: "fa-solid fa-clock",
        preorder: "fa-solid fa-clipboard-check",
        new: "fa-solid fa-bolt",
        stockout: "fa-solid fa-box-open"
    };

    const sectionPromises = (home.productSections || []).map(function (ps) {
        const kind = KIND_BASE[ps.kind] !== undefined ? ps.kind : "custom";
        const limit = Math.min(Math.max(Number(ps.count) || 10, 2), 24);
        const filter = Object.assign({ isActive: true }, KIND_BASE[kind]);
        let viewAll = "/shop?sort=latest";

        if ((ps.scope === "category" || ps.scope === "subcategory" || ps.scope === "childcategory") && ps.categorySlug) {
            const paths = collectFamilyPaths(allCategories, ps.categorySlug);
            Object.assign(filter, categoryMatchFilter(paths));
            viewAll = "/category/" + encodeURIComponent(ps.categorySlug);
        } else if (ps.scope === "brand" && ps.brand) {
            const brandFilter = brandMatchFilter(ps.brand);
            if (brandFilter) {
                Object.assign(filter, brandFilter);
            }
            viewAll = "/shop?brand=" + encodeURIComponent(brandNames(ps.brand)[0] || "");
        } else if (ps.scope === "products" && ps.products) {
            const slugs = String(ps.products)
                .split(",")
                .map(function (s) { return s.trim().toLowerCase(); })
                .filter(Boolean);
            filter.slug = { $in: slugs };
            viewAll = "/shop";
        }

        return Product.find(filter)
            .sort({ stockRank: 1, createdAt: -1 })
            .limit(limit)
            .lean()
            .then(function (products) {
                if (!products.length) return null;

                return {
                    kind: kind,
                    title: ps.title || "Products",
                    icon: ps.icon || KIND_ICON[kind] || KIND_ICON.custom,
                    viewAll: viewAll,
                    products: products
                };
            });
    });

    /* ---------- ফিচার্ড ক্যাটাগরি ---------- */
    let featuredPromise = Promise.resolve([]);

    if (home.featEnabled) {
        const slugs = home.featSlugs || [];
        const query = slugs.length
            ? { slug: { $in: slugs }, isActive: { $ne: false } }
            : { parent: "", isActive: { $ne: false } };

        featuredPromise = Category.find(query)
            .sort({ order: 1, name: 1 })
            .limit(slugs.length ? 60 : 8)
            .lean()
            .then(function (cats) {
                if (!slugs.length) return cats;

                const orderMap = {};
                slugs.forEach(function (s, i) { orderMap[s] = i; });
                cats.sort(function (a, b) {
                    return (orderMap[a.slug] || 0) - (orderMap[b.slug] || 0);
                });
                return cats;
            });
    }

    const [blocks, featuredCats] = await Promise.all([
        Promise.all(sectionPromises),
        featuredPromise
    ]);

    const productBlocks = blocks.filter(Boolean);

    /* ---------- ইমেজ সেকশন স্লট অনুযায়ী ---------- */
    const imagesBySlot = {};
    for (const im of home.imageSections || []) {
        if (!imagesBySlot[im.slot]) imagesBySlot[im.slot] = [];
        imagesBySlot[im.slot].push(im);
    }

    /* "after-<kind>" banners follow the last block of that kind. If no
       block of that kind exists they move to the end of the product area. */
    const lastBlockByKind = {};
    productBlocks.forEach(function (block, i) {
        lastBlockByKind[block.kind] = i;
    });

    const imagesAfterBlock = {};
    const imagesAfterProducts = [];

    Object.keys(imagesBySlot).forEach(function (slot) {
        const match = /^after-(latest|custom|upcoming|preorder|new|stockout)$/.exec(slot);
        if (!match) return;

        const idx = lastBlockByKind[match[1]];
        if (idx === undefined) {
            imagesAfterProducts.push.apply(imagesAfterProducts, imagesBySlot[slot]);
        } else {
            if (!imagesAfterBlock[idx]) imagesAfterBlock[idx] = [];
            imagesAfterBlock[idx].push.apply(imagesAfterBlock[idx], imagesBySlot[slot]);
        }
    });

    return {
        home: home,
        productBlocks: productBlocks,
        featuredCats: featuredCats,
        imagesBySlot: imagesBySlot,
        imagesAfterBlock: imagesAfterBlock,
        imagesAfterProducts: imagesAfterProducts
    };
}

exports.getHome = async (req, res) => {
    try {
        /* siteData already loaded and cached the active category tree. */
        const allCategories = (res.locals.allCategories || []).length
            ? res.locals.allCategories
            : await siteData.getCategories().then(function (c) { return c.flat; });

        const payload = await cache.wrap(
            "store:home",
            HOME_CACHE_MS,
            function () { return buildHomePayload(allCategories); }
        );

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

        const {
            home,
            productBlocks,
            featuredCats,
            imagesBySlot,
            imagesAfterBlock,
            imagesAfterProducts
        } = payload;

        return res.render("index", {
            pageTitle: "Mizan Trade - Computer Components Distributor in Bangladesh",
            heroSlides: home.heroSlides,
            heroSideWidth: home.heroSideWidth,
            heroSideCards: home.heroSideCards,
            whyTitle: home.whyTitle,
            whySubtitle: home.whySubtitle,
            whyDescription: home.whyDescription,
            whyItems: home.whyItems,
            featTitle: home.featTitle,
            featSubtitle: home.featSubtitle,
            featDescription: home.featDescription,
            featuredCats,
            productBlocks,
            imagesAfterBlock,
            imagesAfterProducts,
            imagesBySlot,
            brandSectionTitle: home.brandSectionTitle,
            brandLogos: home.brandLogos
        });
    } catch (error) {
        console.error("Home page error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   SHOP / CATEGORY PAGE (search, filter, sort, pagination)
====================================================== */

async function renderShop(req, res, extraFilter, pageTitle, category, trail) {
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

    // Group selected spec values by attribute: within one attribute values
    // are OR-ed (multi-select), different attributes are AND-ed.
    const specGroups = new Map();
    specSel.forEach(function (s) {
        const idx = s.indexOf("::");
        const key = s.slice(0, idx).trim();
        const value = s.slice(idx + 2).trim();
        if (!key || !value) return;
        const norm = key.toLowerCase();
        if (!specGroups.has(norm)) specGroups.set(norm, { key: key, values: [] });
        specGroups.get(norm).values.push(value);
    });

    specGroups.forEach(function (group) {
        const keyRe = new RegExp(
            "^" + group.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
            "i"
        );
        const valueOr = group.values.map(function (value) {
            return {
                specs: {
                    $elemMatch: {
                        key: keyRe,
                        value: new RegExp(
                            "^" + value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                            "i"
                        )
                    }
                }
            };
        });
        conditions.push(valueOr.length === 1 ? valueOr[0] : { $or: valueOr });
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

    const [products, total, facetDocs] = await Promise.all([
        Product.find(filter)
            .sort(Object.assign({ stockRank: 1 }, sortMap[sort] || sortMap.latest))
            .skip(skip)
            .limit(PRODUCTS_PER_PAGE)
            .lean(),
        Product.countDocuments(filter),
        // Facets are computed from the category scope only (ignoring the
        // currently-selected brand/spec filters) so options stay toggleable.
        Product.find(
            extraFilter ? { $and: [{ isActive: true }, extraFilter] } : { isActive: true }
        ).select("specs brand").lean()
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

    // Brand facets with product counts (brand field or a "Brand" spec pair).
    const brandCounts = new Map();
    facetDocs.forEach(function (doc) {
        let name = String(doc.brand || "").trim();
        if (!name) {
            const sp = (doc.specs || []).find(function (item) {
                return /^brand$/i.test(String(item.key || "").trim()) &&
                    String(item.value || "").trim();
            });
            name = sp ? String(sp.value).trim() : "";
        }
        if (!name) return;
        brandCounts.set(name, (brandCounts.get(name) || 0) + 1);
    });
    const brandOptions = Array.from(brandCounts.entries())
        .map(function (entry) {
            return {
                name: entry[0],
                count: entry[1],
                selected: brandList.some(function (b) {
                    return b.toLowerCase() === entry[0].toLowerCase();
                })
            };
        })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });

    /* Breadcrumb trail + heading, e.g.
       SSD > SATA III 2.5-Inch SSD > KingSpec
       → "KingSpec SATA III 2.5-Inch SSD Price in Bangladesh" */
    const categoryChain = Array.isArray(trail) ? trail : [];
    const activeCategory = category ||
        (categoryChain.length ? categoryChain[categoryChain.length - 1] : null);

    let pageHeading = "";
    if (activeCategory) {
        const parent = categoryChain.length >= 2
            ? categoryChain[categoryChain.length - 2]
            : null;
        pageHeading = (categoryChain.length >= 3 && parent)
            ? activeCategory.name + " " + parent.name + " Price in Bangladesh"
            : activeCategory.name + " Price in Bangladesh";
    }

    const docTitle = pageHeading ? pageHeading + " - Mizan Trade" : pageTitle;

    res.locals.seo = buildSeo({
        title: docTitle,
        description: "মিজান ট্রেডে কম্পিউটার কম্পোনেন্ট ও হার্ডওয়্যার কিনুন — SSD, RAM, Motherboard, Processor, Laptop, Monitor ও এক্সেসরিজ সেরা দামে।",
        path: req.path,
        type: "website"
    });

    return res.render("shop", {
        pageTitle: docTitle,
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
        brandOptions: brandOptions,
        specFacets: specFacets,
        specSel: specSel,
        activeCategory: activeCategory,
        categoryTrail: categoryChain,
        pageHeading: pageHeading
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

            const paths = collectFamilyPaths(allCategories, cat);
            const extraFilter = categoryMatchFilter(paths);
            const trail = categoryTrail(allCategories, cat);

            return renderShop(req, res, extraFilter, category ? category.name + " - Mizan Trade" : "Shop", category, trail);
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
        const paths = collectFamilyPaths(allCategories, category.slug);
        const extraFilter = categoryMatchFilter(paths);
        const trail = categoryTrail(allCategories, category.slug);

        return renderShop(
            req,
            res,
            extraFilter,
            category.name + " - Mizan Trade",
            category,
            trail
        );
    } catch (error) {
        console.error("Category page error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   OFFERS / DEALS PAGE — products with a real discount
====================================================== */

exports.getOffers = async (req, res) => {
    try {
        const [products, offerDocs, categories] = await Promise.all([
            Product.find({
                isActive: true,
                callForPrice: false,
                salePrice: { $ne: null, $gt: 0 },
                regularPrice: { $ne: null, $gt: 0 },
                $expr: { $gt: ["$regularPrice", "$salePrice"] }
            })
                .sort({ stockRank: 1, createdAt: -1 })
                .lean(),

            Offer.find({ isActive: true })
                .sort({ order: 1, createdAt: 1 })
                .lean(),

            Category.find({ isActive: { $ne: false } })
                .sort({ order: 1, name: 1 })
                .lean()
        ]);

        /* ---------- category index ---------- */

        const catBySlug = new Map();
        const catByName = new Map();

        categories.forEach(function (cat) {
            catBySlug.set(cat.slug, cat);
            if (!catByName.has(cat.name)) catByName.set(cat.name, cat);
        });

        function ancestrySlugs(cat) {
            const set = new Set();
            const guard = new Set();
            let current = cat;

            while (current && !guard.has(current.slug)) {
                guard.add(current.slug);
                set.add(current.slug);
                current = current.parent ? catBySlug.get(current.parent) : null;
            }

            return set;
        }

        const categoryOptions = categories
            .map(function (cat) {
                const set = ancestrySlugs(cat);
                const chain = [];

                let current = cat;
                const guard = new Set();
                while (current && !guard.has(current.slug)) {
                    guard.add(current.slug);
                    chain.unshift(current.name);
                    current = current.parent ? catBySlug.get(current.parent) : null;
                }

                return {
                    slug: cat.slug,
                    name: cat.name,
                    parent: cat.parent || "",
                    level: set.size,
                    path: chain.join(" › ")
                };
            })
            .sort(function (a, b) {
                return a.path.localeCompare(b.path);
            });

        /* ---------- products referenced by offers ---------- */

        const referencedIds = [];
        const seenIds = new Set();

        offerDocs.forEach(function (offer) {
            (offer.products || []).forEach(function (id) {
                const key = String(id);
                if (!seenIds.has(key)) {
                    seenIds.add(key);
                    referencedIds.push(key);
                }
            });
        });

        const scopedProducts = referencedIds.length
            ? await Product.find({ _id: { $in: referencedIds } })
                  .select("title slug mainCategory subCategory childCategory")
                  .lean()
            : [];

        const productPool = new Map();

        products.forEach(function (product) {
            productPool.set(String(product._id), product);
        });
        scopedProducts.forEach(function (product) {
            productPool.set(String(product._id), product);
        });

        function productFamily(product) {
            const set = new Set();
            if (!product) return set;

            [
                product.mainCategory,
                product.subCategory,
                product.childCategory
            ].forEach(function (name) {
                if (!name) return;
                const cat = catByName.get(name) || catBySlug.get(name);
                if (cat) {
                    ancestrySlugs(cat).forEach(function (slug) {
                        set.add(slug);
                    });
                } else if (catBySlug.has(name)) {
                    set.add(name);
                }
            });

            return set;
        }

        /* ---------- offer family + display labels ---------- */

        offerDocs.forEach(function (offer) {
            const family = new Set();

            function addSlug(slug) {
                if (!slug) return;
                family.add(slug);
                const cat = catBySlug.get(slug);
                if (cat) {
                    ancestrySlugs(cat).forEach(function (item) {
                        family.add(item);
                    });
                }
            }

            (offer.categories || []).forEach(addSlug);
            (offer.subCategories || []).forEach(addSlug);
            (offer.childCategories || []).forEach(addSlug);

            (offer.products || []).forEach(function (id) {
                const product = productPool.get(String(id));
                if (!product) return;
                productFamily(product).forEach(function (slug) {
                    family.add(slug);
                });
            });

            offer.__family = family;
            offer.__general =
                !(offer.categories || []).length &&
                !(offer.subCategories || []).length &&
                !(offer.childCategories || []).length &&
                !(offer.products || []).length;

            const offerType = String(offer.type || "").trim() || "Other";

            offer.priceLabel = offerPriceLabel(offer.price);
            offer.typeIcon = offerTypeIcon(offerType);
            offer.typeLabel = /offers$/i.test(offerType)
                ? offerType
                : offerType + " Offers";
        });

        /* ---------- filters ---------- */

        const filterCategory = String(req.query.category || "").trim();
        const filterSub = String(req.query.subCategory || "").trim();
        const filterChild = String(req.query.childCategory || "").trim();
        const filterProduct = String(req.query.product || "").trim();

        const hasFilters = Boolean(
            filterCategory || filterSub || filterChild || filterProduct
        );

        function matchesFilters(offer) {
            if (offer.__general) return true;

            if (filterCategory && !offer.__family.has(filterCategory)) return false;
            if (filterSub && !offer.__family.has(filterSub)) return false;
            if (filterChild && !offer.__family.has(filterChild)) return false;

            if (filterProduct) {
                const listed = (offer.products || []).some(function (id) {
                    return String(id) === filterProduct;
                });

                if (!listed) {
                    const product = productPool.get(filterProduct);
                    if (!product) return false;

                    const family = productFamily(product);
                    let relevant = false;
                    family.forEach(function (slug) {
                        if (offer.__family.has(slug)) relevant = true;
                    });

                    if (!relevant) return false;
                }
            }

            return true;
        }

        const filteredOffers = offerDocs.filter(matchesFilters);

        /* ---------- group by free-text type ---------- */

        const offerGroups = [];
        const groupByType = new Map();

        filteredOffers.forEach(function (offer) {
            const type = String(offer.type || "").trim() || "Other";
            let group = groupByType.get(type);

            if (!group) {
                group = {
                    type: type,
                    label: /offers$/i.test(type) ? type : type + " Offers",
                    icon: offerTypeIcon(type),
                    items: []
                };
                groupByType.set(type, group);
                offerGroups.push(group);
            }

            group.items.push(offer);
        });

        const filterProducts = Array.from(productPool.values())
            .filter(function (product) {
                return product && product.title;
            })
            .sort(function (a, b) {
                return String(a.title).localeCompare(String(b.title));
            });

        res.locals.seo = buildSeo({
            title: "Offers & Deals - Mizan Trade",
            description: "সর্বশেষ ছাড় ও অফার — Mizan Trade-এ ডিসকাউন্ট দামে কম্পিউটার কম্পোনেন্ট ও হার্ডওয়্যার কিনুন।",
            path: req.path,
            type: "website"
        });

        return res.render("offers", {
            pageTitle: "Offers & Deals",
            products,
            offerGroups,
            offerList: filteredOffers,
            totalOffers: offerDocs.length,
            filteredOffers: filteredOffers.length,
            categoryOptions,
            filterProducts,
            filters: {
                category: filterCategory,
                subCategory: filterSub,
                childCategory: filterChild,
                product: filterProduct
            },
            hasFilters,
            partner: req.session.partner || null
        });
    } catch (error) {
        console.error("Offers page error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   PUBLIC SINGLE OFFER DETAIL
====================================================== */

exports.getOfferDetail = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).render("errors/404", { pageTitle: "Offer Not Found" });
        }

        const offer = await Offer.findOne({
            _id: req.params.id,
            isActive: true
        }).lean();

        if (!offer) {
            return res.status(404).render("errors/404", { pageTitle: "Offer Not Found" });
        }

        const groupOffers = await Offer.find({
            isActive: true,
            type: offer.type
        })
            .sort({ order: 1, createdAt: 1 })
            .lean();

        groupOffers.forEach(function (item) {
            item.priceLabel = offerPriceLabel(item.price);
        });
        offer.priceLabel = offerPriceLabel(offer.price);
        offer.typeIcon = offerTypeIcon(offer.type);

        const typeLabel = /offers$/i.test(offer.type || "")
            ? offer.type
            : (offer.type || "Other") + " Offers";

        const plain = String(offer.content || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        res.locals.seo = buildSeo({
            title: offer.name + " - Offers - Mizan Trade",
            description: plain.slice(0, 160) || (offer.name + " — latest offer from Mizan Trade."),
            path: req.path,
            type: "website"
        });

        return res.render("offerDetail", {
            pageTitle: offer.name,
            offer,
            groupOffers,
            typeLabel,
            partner: req.session.partner || null,
            hotline: siteConfig.hotline,
            email: siteConfig.email
        });
    } catch (error) {
        console.error("Offer detail error:", error);
        return res.status(500).render("errors/500");
    }
};

