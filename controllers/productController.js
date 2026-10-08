const Product = require("../models/Product");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const { buildSeo, baseUrl, absoluteUrl, stripHtml } = require("../utils/seo");
const siteConfig = require("../config/site");


/* ======================================================
   HELPERS
====================================================== */

function createSlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function toPrice(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function generateSku(seed) {
    let hash = 0;

    const text =
        (seed || "") + Date.now() + Math.random();

    for (let i = 0; i < text.length; i++) {
        hash =
            (hash << 5) -
            hash +
            text.charCodeAt(i);
        hash |= 0;
    }

    return (
        "MT-" +
        String(Math.abs(hash) % 1000000).padStart(6, "0")
    );
}


async function uniqueSlug(base, ignoreId) {
    let slug = base;
    let suffix = 2;

    while (true) {
        const query = { slug };

        if (ignoreId) query._id = { $ne: ignoreId };

        const exists = await Product.findOne(query).select("_id");

        if (!exists) return slug;

        slug = base + "-" + suffix;
        suffix++;
    }
}


async function uniqueSku(base, ignoreId) {
    let sku = base;

    while (true) {
        const query = { sku };

        if (ignoreId) query._id = { $ne: ignoreId };

        const exists = await Product.findOne(query).select("_id");

        if (!exists) return sku;

        sku = generateSku(sku);
    }
}


function sanitizeHtml(html) {
    return String(html || "")
        .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
        .replace(/<\s*\/?\s*(script|style)[^>]*>/gi, "")
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}


function parseSpecs(body) {
    const keys = [].concat(body.specKey || []);
    const values = [].concat(body.specValue || []);

    return keys
        .map((key, index) => ({
            key: String(key || "").trim(),
            value: String(values[index] || "").trim()
        }))
        .filter((spec) => spec.key && spec.value);
}


/* Saved attribute keys/values so the next product can reuse them. */
async function syncAttributeRegistry(specs) {
    const grouped = new Map();

    (specs || []).forEach(function (spec) {
        if (!grouped.has(spec.key)) grouped.set(spec.key, new Set());
        grouped.get(spec.key).add(spec.value);
    });

    for (const [key, valueSet] of grouped) {
        const doc = await Attribute.findOne({ key: key });

        if (doc) {
            valueSet.forEach(function (v) {
                if (doc.values.indexOf(v) === -1) doc.values.push(v);
            });
            await doc.save();
        } else {
            await Attribute.create({ key: key, values: Array.from(valueSet) });
        }
    }
}

async function getAttributeRegistry() {
    return Attribute.find({}).sort({ key: 1 }).lean();
}


async function getCategoryOptions() {
    const all = await Category.find({})
        .sort({ order: 1, name: 1 })
        .lean();

    function node(cat) {
        return {
            name: cat.name,
            slug: cat.slug,
            brands: cat.brands || [],
            children: all
                .filter((child) => child.parent === cat.slug)
                .map(node)
        };
    }

    return all
        .filter((cat) => !cat.parent)
        .map(node);
}


/* ======================================================
   ADMIN - PRODUCT LIST
====================================================== */

exports.getAdminProducts = async (req, res) => {
    try {
        const search = String(
            req.query.search || ""
        ).trim();

        const category = String(
            req.query.category || ""
        ).trim();

        const status = String(
            req.query.status || ""
        ).trim();

        const filter = {};

        if (category) {
            filter.mainCategory = category;
        }

        if (status === "active") {
            filter.isActive = true;
        }

        if (status === "inactive") {
            filter.isActive = false;
        }

        if (search) {
            filter.$or = [
                {
                    title: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    sku: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    brand: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    mainCategory: {
                        $regex: search,
                        $options: "i"
                    }
                }
            ];
        }

        const [products, categories] = await Promise.all([
            Product.find(filter).sort({
                createdAt: -1
            }),
            Product.distinct("mainCategory")
        ]);

        return res.render(
            "admin/products",
            {
                products,
                search,
                category,
                status,
                categories: categories.sort(),
                pageTitle: "Products"
            }
        );

    } catch (error) {
        console.error(
            "Admin Product List Error:",
            error
        );

        return res.status(500).render(
            "errors/500"
        );
    }
};


/* ======================================================
   ADMIN - ADD PRODUCT PAGE
====================================================== */

exports.getAddProductPage = async (req, res) => {
    try {
        const [categories, attrRegistry] = await Promise.all([
            getCategoryOptions(),
            getAttributeRegistry()
        ]);

        return res.render(
            "admin/addProduct",
            {
                categories,
                attrRegistry,
                pageTitle: "Add Product"
            }
        );
    } catch (error) {
        console.error("Add Product Page Error:", error);
        return res.status(500).render("errors/500");
    }
};


/* ======================================================
   ADMIN - ADD PRODUCT
====================================================== */

exports.postAddProduct = async (req, res) => {
    try {
        const {
            title,
            slug,
            sku,
            mainCategory,
            subCategory,
            childCategory,
            brand,
            regularPrice,
            salePrice,
            callForPrice,
            stockStatus,
            shortDesc,
            longDesc,
            isActive
        } = req.body;


        if (!title || !mainCategory) {
            return res.status(400).send(
                "Product title and category are required."
            );
        }


        /* -----------------------------------------------
           SLUG (auto + unique)
        ------------------------------------------------ */

        const slugBase =
            createSlug(slug || title);

        if (!slugBase) {
            return res.status(400).send(
                "A valid product slug is required."
            );
        }

        const productSlug = await uniqueSlug(slugBase);


        /* -----------------------------------------------
           SKU (auto + unique)
        ------------------------------------------------ */

        const skuBase =
            sku && sku.trim()
                ? sku.trim().toUpperCase()
                : generateSku(title);

        const productSku = await uniqueSku(skuBase);


        /* -----------------------------------------------
           IMAGE
        ------------------------------------------------ */

        let mainImage = "";

        let galleryImages = [];


        if (req.files) {

            if (
                req.files.mainImage &&
                req.files.mainImage.length > 0
            ) {
                mainImage =
                    "/uploads/" +
                    req.files.mainImage[0].filename;
            }


            if (
                req.files.galleryImages &&
                req.files.galleryImages.length > 0
            ) {
                galleryImages =
                    req.files.galleryImages.map(
                        (file) =>
                            "/uploads/" +
                            file.filename
                    );
            }
        }


        /* -----------------------------------------------
           CREATE PRODUCT
        ------------------------------------------------ */

        const specList = parseSpecs(req.body);

        await Product.create({
            title: title.trim(),

            slug: productSlug,

            sku: productSku,

            mainCategory:
                mainCategory.trim(),

            subCategory:
                subCategory
                    ? subCategory.trim()
                    : "",

            childCategory:
                childCategory
                    ? childCategory.trim()
                    : "",

            brand:
                brand
                    ? brand.trim()
                    : "",

            regularPrice:
                toPrice(regularPrice),

            salePrice:
                toPrice(salePrice),

            callForPrice:
                callForPrice === "true" ||
                callForPrice === "on",

            stockStatus:
                stockStatus ||
                "In Stock",

            mainImage,

            galleryImages,

            shortDesc:
                sanitizeHtml(shortDesc),

            longDesc:
                sanitizeHtml(longDesc),

            specs: specList,

            isActive:
                isActive === "on" ||
                isActive === "true"
        });

        await syncAttributeRegistry(specList);

        return res.redirect(
            "/admin/products"
        );

    } catch (error) {

        console.error(
            "Add Product Error:",
            error
        );

        if (
            error.code === 11000
        ) {
            return res.status(400).send(
                "Product slug or SKU already exists."
            );
        }

        return res.status(500).send(
            "Unable to add product."
        );
    }
};


/* ======================================================
   ADMIN - EDIT PRODUCT PAGE
====================================================== */

exports.getEditProductPage =
    async (req, res) => {

        try {

            const product =
                await Product.findById(
                    req.params.id
                );

            if (!product) {
                return res.status(404).send(
                    "Product not found."
                );
            }

            const [categories, attrRegistry] = await Promise.all([
                getCategoryOptions(),
                getAttributeRegistry()
            ]);

            return res.render(
                "admin/editProduct",
                {
                    product,
                    categories,
                    attrRegistry,
                    pageTitle: "Edit Product"
                }
            );

        } catch (error) {

            console.error(
                "Edit Product Page Error:",
                error
            );

            return res.status(500).send(
                "Server Error"
            );
        }
    };


/* ======================================================
   ADMIN - UPDATE PRODUCT
====================================================== */

exports.postEditProduct =
    async (req, res) => {

        try {

            const {
                title,
                slug,
                sku,
                mainCategory,
                subCategory,
                childCategory,
                brand,
                regularPrice,
                salePrice,
                callForPrice,
                stockStatus,
                shortDesc,
                longDesc,
                isActive
            } = req.body;


            const updateData = {

                title:
                    title
                        ? title.trim()
                        : "",

                slug: await uniqueSlug(
                    createSlug(slug || title),
                    req.params.id
                ),

                sku: await uniqueSku(
                    sku && sku.trim()
                        ? sku.trim().toUpperCase()
                        : generateSku(title),
                    req.params.id
                ),

                mainCategory:
                    mainCategory
                        ? mainCategory.trim()
                        : "",

                subCategory:
                    subCategory
                        ? subCategory.trim()
                        : "",

                childCategory:
                    childCategory
                        ? childCategory.trim()
                        : "",

                brand:
                    brand
                        ? brand.trim()
                        : "",

                regularPrice:
                    toPrice(regularPrice),

                salePrice:
                    toPrice(salePrice),

                callForPrice:
                    callForPrice === "true" ||
                    callForPrice === "on",

                stockStatus:
                    stockStatus ||
                    "In Stock",

                shortDesc:
                    sanitizeHtml(shortDesc),

                longDesc:
                    sanitizeHtml(longDesc),

                specs: parseSpecs(req.body),

                isActive:
                    isActive === "on" ||
                    isActive === "true"
            };


            /* -------------------------------------------
               MAIN IMAGE
            ------------------------------------------- */

            if (
                req.files &&
                req.files.mainImage &&
                req.files.mainImage.length > 0
            ) {
                updateData.mainImage =
                    "/uploads/" +
                    req.files.mainImage[0].filename;
            }


            /* -------------------------------------------
               GALLERY
            ------------------------------------------- */

            if (
                req.files &&
                req.files.galleryImages &&
                req.files.galleryImages.length > 0
            ) {
                updateData.galleryImages =
                    req.files.galleryImages.map(
                        (file) =>
                            "/uploads/" +
                            file.filename
                    );
            }


            await Product.findByIdAndUpdate(
                req.params.id,
                updateData,
                {
                    new: true,
                    runValidators: true
                }
            );

            await syncAttributeRegistry(updateData.specs || []);

            return res.redirect(
                "/admin/products"
            );

        } catch (error) {

            console.error(
                "Edit Product Error:",
                error
            );

            if (
                error.code === 11000
            ) {
                return res.status(400).send(
                    "Product slug or SKU already exists."
                );
            }

            return res.status(500).send(
                "Unable to update product."
            );
        }
    };


/* ======================================================
   ADMIN - RICH TEXT EDITOR IMAGE UPLOAD
====================================================== */

exports.postUploadImage = (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No image received."
        });
    }

    return res.json({
        success: true,
        url: "/uploads/" + req.file.filename
    });
};


exports.postUploadMedia = (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No file received."
        });
    }

    return res.json({
        success: true,
        url: "/uploads/" + req.file.filename,
        type: req.file.mimetype.indexOf("video/") === 0 ? "video" : "image"
    });
};


/* ======================================================
   ADMIN - DELETE PRODUCT
====================================================== */

exports.deleteProduct =
    async (req, res) => {

        try {

            const product =
                await Product.findById(
                    req.params.id
                );

            if (!product) {
                return res.status(404).send(
                    "Product not found."
                );
            }

            await Product.findByIdAndDelete(
                req.params.id
            );

            return res.redirect(
                "/admin/products"
            );

        } catch (error) {

            console.error(
                "Delete Product Error:",
                error
            );

            return res.status(500).send(
                "Unable to delete product."
            );
        }
    };


exports.duplicateProduct =
    async (req, res) => {

        try {

            const source =
                await Product.findById(
                    req.params.id
                );

            if (!source) {
                return res.status(404).send(
                    "Product not found."
                );
            }

            const copy = source.toObject();
            delete copy._id;
            delete copy.createdAt;
            delete copy.updatedAt;

            copy.title = source.title + " (Copy)";

            let slug = source.slug + "-copy";
            let n = 2;
            while (await Product.findOne({ slug: slug })) {
                slug = source.slug + "-copy-" + n;
                n++;
            }
            copy.slug = slug;

            copy.sku = "";
            copy.reviews = [];
            copy.questions = [];

            const created = await Product.create(copy);

            return res.redirect(
                "/admin/product/edit/" + created._id
            );

        } catch (error) {

            console.error(
                "Duplicate Product Error:",
                error
            );

            return res.status(500).send(
                "Unable to duplicate product."
            );
        }
    };


/* ======================================================
   SINGLE PRODUCT
====================================================== */

exports.getSingleProduct =
    async (req, res) => {

        try {

            const product =
                await Product.findOne({
                    slug: req.params.slug
                });

            if (!product) {
                return res.status(404).send(
                    "Product not found."
                );
            }


            const similarProducts =
                await Product.find({
                    mainCategory:
                        product.mainCategory,

                    _id: {
                        $ne: product._id
                    },

                    isActive: true
                }).limit(4);


            /* ===== Auto SEO + Product structured data ===== */

            const approvedReviews =
                (product.reviews || []).filter((r) => r.isApproved);

            const price =
                product.salePrice ||
                product.regularPrice ||
                0;

            const inStock =
                product.stockStatus === "In Stock";

            const jsonLd = {
                "@context": "https://schema.org",
                "@type": "Product",
                name: product.title,
                image: absoluteUrl(product.mainImage || "/images/logo.svg"),
                description: stripHtml(
                    product.shortDesc || product.longDesc || ""
                ).slice(0, 300),
                sku: product.sku || undefined,
                brand: product.brand
                    ? { "@type": "Brand", name: product.brand }
                    : undefined,
                offers: {
                    "@type": "Offer",
                    url: baseUrl() + "/product/" + product.slug,
                    priceCurrency: "BDT",
                    price: price,
                    availability: inStock
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                    itemCondition: "https://schema.org/NewCondition"
                }
            };

            if (approvedReviews.length > 0) {
                const avg =
                    approvedReviews.reduce((s, r) => s + Number(r.rating), 0) /
                    approvedReviews.length;

                jsonLd.aggregateRating = {
                    "@type": "AggregateRating",
                    ratingValue: Math.round(avg * 10) / 10,
                    reviewCount: approvedReviews.length,
                    bestRating: 5
                };
            }

            res.locals.seo = buildSeo({
                title: product.title,
                description: stripHtml(
                    product.shortDesc || product.longDesc || ""
                ),
                keywords: [product.brand, product.mainCategory, product.subCategory]
                    .filter(Boolean)
                    .join(", "),
                path: "/product/" + product.slug,
                image: product.mainImage || "/images/logo.svg",
                type: "product",
                jsonLd
            });


            return res.render(
                "singleProduct",
                {
                    product,
                    similarProducts
                }
            );

        } catch (error) {

            console.error(
                "Single Product Error:",
                error
            );

            return res.status(500).send(
                "Server Error"
            );
        }
    };


/* ======================================================
   PRODUCT REVIEW
====================================================== */

exports.postProductReview =
    async (req, res) => {

        try {

            const {
                name,
                rating,
                comment
            } = req.body;


            const product =
                await Product.findById(
                    req.params.id
                );


            if (!product) {
                return res.status(404).send(
                    "Product not found."
                );
            }


            product.reviews.push({
                name,
                rating: Number(rating),
                comment,
                isApproved: false
            });


            await product.save();


            return res.redirect(
                "back"
            );

        } catch (error) {

            console.error(
                "Review Error:",
                error
            );

            return res.status(500).send(
                "Unable to submit review."
            );
        }
    };


/* ======================================================
   PRODUCT QUESTION
====================================================== */

exports.postProductQuestion =
    async (req, res) => {

        try {

            const {
                name,
                question
            } = req.body;


            const product =
                await Product.findById(
                    req.params.id
                );


            if (!product) {
                return res.status(404).send(
                    "Product not found."
                );
            }


            product.questions.push({
                name,
                question,
                isApproved: false
            });


            await product.save();


            return res.redirect(
                "/product/" + product.slug
            );

        } catch (error) {

            console.error(
                "Question Error:",
                error
            );

            return res.status(500).send(
                "Unable to submit question."
            );
        }
    };


/* ======================================================
   ADMIN: CUSTOMER QUESTIONS
====================================================== */

exports.getAdminQuestions = async (req, res) => {
    try {
        const products = await Product.find({})
            .select("title slug questions")
            .lean();

        const rows = [];
        products.forEach(function (p) {
            (p.questions || []).forEach(function (q) {
                rows.push({
                    productId: p._id,
                    productTitle: p.title,
                    productSlug: p.slug,
                    questionId: q._id,
                    name: q.name,
                    question: q.question,
                    answer: q.answer || "",
                    isApproved: !!q.isApproved,
                    createdAt: q.createdAt
                });
            });
        });

        rows.sort(function (a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return res.render("admin/questions", {
            title: "Customer Questions",
            rows: rows
        });
    } catch (error) {
        console.error("Admin questions error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postAnswerQuestion = async (req, res) => {
    try {
        const { answer } = req.body;
        const product = await Product.findById(req.params.productId);
        if (!product) return res.status(404).send("Product not found.");

        const q = product.questions.id(req.params.questionId);
        if (!q) return res.status(404).send("Question not found.");

        q.answer = answer || "";
        q.isApproved = true;
        await product.save();

        return res.redirect("/admin/questions");
    } catch (error) {
        console.error("Answer question error:", error);
        return res.status(500).send("Unable to save answer.");
    }
};

exports.getToggleQuestionApproval = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) return res.status(404).send("Product not found.");

        const q = product.questions.id(req.params.questionId);
        if (!q) return res.status(404).send("Question not found.");

        q.isApproved = !q.isApproved;
        await product.save();

        return res.redirect("/admin/questions");
    } catch (error) {
        console.error("Toggle question error:", error);
        return res.status(500).send("Unable to update question.");
    }
};

exports.getDeleteQuestion = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) return res.status(404).send("Product not found.");

        product.questions.pull(req.params.questionId);
        await product.save();

        return res.redirect("/admin/questions");
    } catch (error) {
        console.error("Delete question error:", error);
        return res.status(500).send("Unable to delete question.");
    }
};


/* ======================================================
   ADD TO CART
====================================================== */

exports.addToCart =
    async (req, res) => {

        try {

            const quantity =
                Number(
                    req.body.quantity
                ) || 1;


            if (
                req.headers.accept &&
                req.headers.accept.includes(
                    "application/json"
                )
            ) {

                return res.json({
                    success: true,
                    message:
                        "Product added to cart.",
                    quantity
                });
            }


            return res.redirect(
                "back"
            );

        } catch (error) {

            console.error(error);

            return res.status(500).send(
                "Server Error"
            );
        }
    };


/* ======================================================
   COMPARE
====================================================== */

exports.addToCompare =
    async (req, res) => {

        try {

            if (
                req.headers.accept &&
                req.headers.accept.includes(
                    "application/json"
                )
            ) {
                return res.json({
                    success: true,
                    message:
                        "Added to compare."
                });
            }

            return res.redirect(
                "back"
            );

        } catch (error) {

            console.error(error);

            return res.status(500).send(
                "Server Error"
            );
        }
    };


/* ======================================================
   WISHLIST
====================================================== */

exports.addToWishlist =
    async (req, res) => {

        try {

            if (
                req.headers.accept &&
                req.headers.accept.includes(
                    "application/json"
                )
            ) {
                return res.json({
                    success: true,
                    message:
                        "Added to wishlist."
                });
            }

            return res.redirect(
                "back"
            );

        } catch (error) {

            console.error(error);

            return res.status(500).send(
                "Server Error"
            );
        }
    };