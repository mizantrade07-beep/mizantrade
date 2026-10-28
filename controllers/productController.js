const Product = require("../models/Product");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const mongoose = require("mongoose");

const {
    buildTree,
    categoryTrail,
} = require("../utils/categoryTree");

const {
    createSlug,
} = require("../utils/slug");

const {
    stockRank,
} = require("../utils/stock");

// ======================================================
// HELPERS
// ======================================================

function toPrice(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) && number >= 0
        ? number
        : null;
}

function toPoints(value) {
    const number = Math.round(Number(value));

    return Number.isFinite(number) && number > 0
        ? number
        : 0;
}

/* Product-এর main/sub/child নামের সাথে মিলে যাওয়া সবচেয়ে নির্দিষ্ট
   ক্যাটাগরি খুঁজে তার root → leaf trail রিটার্ন করে (breadcrumb-এর জন্য)। */
function productCategoryTrail(flat, product) {
    const list = flat || [];
    const wantMain = String(product.mainCategory || "").trim();
    const wantSub = String(product.subCategory || "").trim();
    const wantChild = String(product.childCategory || "").trim();

    let bestTrail = [];

    list.forEach(function (cat) {
        const chain = categoryTrail(list, cat.slug);
        if (!chain.length) return;
        if (wantMain && chain[0].name !== wantMain) return;

        if (wantChild) {
            if (chain.length < 3) return;
            if (chain[chain.length - 1].name !== wantChild) return;
            if (wantSub && chain[chain.length - 2].name !== wantSub) return;
        } else if (wantSub) {
            if (chain.length < 2) return;
            if (chain[chain.length - 1].name !== wantSub) return;
        } else if (wantMain) {
            if (chain.length !== 1) return;
        } else {
            return;
        }

        if (chain.length > bestTrail.length) {
            bestTrail = chain;
        }
    });

    return bestTrail;
}

/* Admin list: Category → Sub Category → Child Category serial order.
   Category `order` and the parent chain decide the sequence. */
function sortProductsByHierarchy(products, categories) {
    const byPath = new Map();

    (categories || []).forEach(function (cat) {
        byPath.set(
            String(cat.parent || "") + "|" + String(cat.name || ""),
            cat
        );
    });

    function pick(parent, name) {
        if (!name) return null;
        return byPath.get(String(parent || "") + "|" + String(name)) || null;
    }

    function orderOf(cat) {
        return cat && Number.isFinite(Number(cat.order))
            ? Number(cat.order)
            : 0;
    }

    return products
        .map(function (product) {
            const main = pick("", product.mainCategory);
            const sub = main
                ? pick(main.slug, product.subCategory)
                : null;
            const child = sub
                ? pick(sub.slug, product.childCategory)
                : null;

            return {
                product,
                key: {
                    mainOrder: main ? orderOf(main) : 9999,
                    mainName: main ? main.name : String(product.mainCategory || ""),
                    subOrder: product.subCategory ? (sub ? orderOf(sub) : 9999) : -1,
                    subName: String(product.subCategory || ""),
                    childOrder: product.childCategory ? (child ? orderOf(child) : 9999) : -1,
                    childName: String(product.childCategory || "")
                }
            };
        })
        .sort(function (a, b) {
            const ka = a.key;
            const kb = b.key;

            if (ka.mainOrder !== kb.mainOrder) return ka.mainOrder - kb.mainOrder;
            if (ka.mainName !== kb.mainName) return ka.mainName.localeCompare(kb.mainName);
            if (ka.subOrder !== kb.subOrder) return ka.subOrder - kb.subOrder;
            if (ka.subName !== kb.subName) return ka.subName.localeCompare(kb.subName);
            if (ka.childOrder !== kb.childOrder) return ka.childOrder - kb.childOrder;
            if (ka.childName !== kb.childName) return ka.childName.localeCompare(kb.childName);

            return String(a.product.title || "").localeCompare(String(b.product.title || ""));
        })
        .map(function (row) {
            return row.product;
        });
}

function generateSku() {
    const random = Math.floor(
        100000 + Math.random() * 900000
    );

    return `MT-${Date.now().toString().slice(-6)}-${random}`;
}

async function uniqueSku(existingSku, ignoreId = null) {
    let sku =
        String(existingSku || "")
            .trim()
            .toUpperCase() || generateSku();

    for (;;) {
        const query = { sku };

        if (ignoreId) {
            query._id = { $ne: ignoreId };
        }

        const exists = await Product.findOne(query)
            .select("_id")
            .lean();

        if (!exists) {
            return sku;
        }

        sku = generateSku();
    }
}

async function uniqueProductSlug(
    value,
    ignoreId = null
) {
    const base =
        createSlug(value) ||
        `product-${Date.now()}`;

    let slug = base;
    let counter = 2;

    for (;;) {
        const query = { slug };

        if (ignoreId) {
            query._id = { $ne: ignoreId };
        }

        const exists = await Product.findOne(query)
            .select("_id")
            .lean();

        if (!exists) {
            return slug;
        }

        slug = `${base}-${counter}`;
        counter++;
    }
}

function getFileUrl(file) {
    if (!file) {
        return "";
    }

    return (
        file.path ||
        file.secure_url ||
        file.url ||
        file.location ||
        (file.filename
            ? `/uploads/${file.filename}`
            : "")
    );
}

function getUploadedFiles(files, fieldName) {
    if (!files || !files[fieldName]) {
        return [];
    }

    return files[fieldName]
        .map(getFileUrl)
        .filter(Boolean);
}

function parseSpecs(specs, specKeys, specValues) {
    // The product form posts two parallel arrays: specKey[] and specValue[].
    if (specKeys !== undefined) {
        const keys = Array.isArray(specKeys) ? specKeys : [specKeys];
        const values = Array.isArray(specValues) ? specValues : [specValues];

        return keys
            .map((key, index) => ({
                key: String(key || "").trim(),
                value: String(values[index] || "").trim(),
            }))
            .filter((item) => item.key && item.value);
    }

    if (!specs) {
        return [];
    }

    if (Array.isArray(specs)) {
        return specs
            .map((item) => ({
                key: String(item?.key || "").trim(),
                value: String(item?.value || "").trim(),
            }))
            .filter(
                (item) => item.key && item.value
            );
    }

    try {
        const parsed = JSON.parse(specs);

        if (Array.isArray(parsed)) {
            return parsed
                .map((item) => ({
                    key: String(item?.key || "").trim(),
                    value: String(item?.value || "").trim(),
                }))
                .filter(
                    (item) =>
                        item.key && item.value
                );
        }
    } catch (error) {
        // Ignore invalid JSON.
    }

    return [];
}

function sanitizeHtml(value) {
    return String(value || "").trim();
}

/* Ordered image list posted from the product form image manager
   (URLs joined with newlines by the client). */
function splitImageList(value) {
    return String(value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

// ======================================================
// ADMIN - PRODUCT LIST
// ======================================================

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

        const conditions = [];

        if (search) {
            conditions.push({
                $or: [
                    {
                        title: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                    {
                        sku: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                    {
                        brand: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                ],
            });
        }

        if (category) {
            conditions.push({
                $or: [
                    { mainCategory: category },
                    { subCategory: category },
                    { childCategory: category },
                ],
            });
        }

        if (status === "active") {
            conditions.push({ isActive: true });
        } else if (status === "inactive") {
            conditions.push({ isActive: false });
        }

        const filter = conditions.length
            ? { $and: conditions }
            : {};

        const [products, categoryDocs] =
            await Promise.all([
                Product.find(filter)
                    .sort({ stockRank: 1, createdAt: -1 })
                    .lean(),
                Category.find({
                    isActive: { $ne: false },
                })
                    .sort({ order: 1, name: 1 })
                    .lean(),
            ]);

        const sortedProducts = sortProductsByHierarchy(
            products,
            categoryDocs
        );

        const categories = categoryDocs
            .map((c) => c.name)
            .filter(Boolean);

        const { tree: categoryTree } =
            buildTree(categoryDocs);

        return res.render("admin/products", {
            products: sortedProducts,
            search,
            category,
            status,
            categories,
            categoryTree,
            duplicated: String(req.query.duplicated || "").trim(),
            pageTitle: "Products",
        });
    } catch (error) {
        console.error(
            "Get Admin Products Error:",
            error
        );

        return res.status(500).send(
            "Unable to load products."
        );
    }
};

// ======================================================
// ADMIN - BULK UPDATE PRODUCTS
// (categories / stock status / pricing)
// ======================================================

exports.bulkUpdateProducts = async (
    req,
    res
) => {
    try {
        const mode = String(
            req.body.mode || ""
        );

        const ids = []
            .concat(req.body.ids || [])
            .map(String)
            .filter((id) =>
                mongoose.Types.ObjectId.isValid(id)
            );

        if (!ids.length) {
            return res.status(400).send(
                "Select at least one product."
            );
        }

        const filter = {
            _id: { $in: ids }
        };

        const update = {};

        if (mode === "category") {
            const main = String(
                req.body.mainCategory || ""
            ).trim();

            const sub = String(
                req.body.subCategory || ""
            ).trim();

            const child = String(
                req.body.childCategory || ""
            ).trim();

            if (!main && !sub && !child) {
                return res.status(400).send(
                    "Choose at least one category level."
                );
            }

            if (main) update.mainCategory = main;
            if (sub) update.subCategory = sub;
            if (child) update.childCategory = child;
        } else if (mode === "stock") {
            const stockStatus = String(
                req.body.stockStatus || ""
            ).trim();

            const allowed = [
                "In Stock",
                "Out of Stock",
                "Pre Order",
                "Coming Soon"
            ];

            if (!allowed.includes(stockStatus)) {
                return res.status(400).send(
                    "Invalid stock status."
                );
            }

            update.stockStatus = stockStatus;
            update.stockRank = stockRank(stockStatus);
        } else if (mode === "price") {
            const regularPrice = toPrice(
                req.body.regularPrice
            );

            const salePrice = toPrice(
                req.body.salePrice
            );

            const clearSale =
                req.body.clearSale === "on" ||
                req.body.clearSale === "true";

            if (
                regularPrice === null &&
                salePrice === null &&
                !clearSale
            ) {
                return res.status(400).send(
                    "Enter a price or tick clear sale price."
                );
            }

            if (regularPrice !== null) {
                update.regularPrice = regularPrice;
            }

            if (salePrice !== null) {
                update.salePrice = salePrice;
            }

            if (clearSale) {
                update.salePrice = null;
            }

            // A price was set, so stop showing "Call for Price".
            if (
                regularPrice !== null ||
                salePrice !== null ||
                clearSale
            ) {
                update.callForPrice = false;
            }
        } else if (mode === "discount") {
            const percent = Number(
                req.body.discountPercent
            );

            const amount = Number(
                req.body.discountAmount
            );

            const usePercent =
                Number.isFinite(percent) &&
                percent > 0 &&
                percent < 100;

            const useAmount =
                Number.isFinite(amount) &&
                amount > 0;

            if (usePercent === useAmount) {
                return res.status(400).send(
                    "Enter exactly one discount: a percent (1-99) or an amount in ৳."
                );
            }

            const scopeAll =
                String(req.body.scope || "") === "all";

            if (!scopeAll && !ids.length) {
                return res.status(400).send(
                    "Select at least one product."
                );
            }

            const filter = scopeAll
                ? { regularPrice: { $gt: 0 } }
                : {
                      _id: { $in: ids },
                      regularPrice: { $gt: 0 }
                  };

            const computed = usePercent
                ? {
                      $round: [
                          {
                              $multiply: [
                                  "$regularPrice",
                                  {
                                      $subtract: [
                                          1,
                                          percent / 100
                                      ]
                                  }
                              ]
                          },
                          2
                      ]
                  }
                : {
                      $subtract: [
                          "$regularPrice",
                          amount
                      ]
                  };

            await Product.updateMany(filter, [
                {
                    $set: {
                        salePrice: {
                            $max: [
                                0,
                                {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$salePrice",
                                                null
                                            ]
                                        },
                                        {
                                            $cond: [
                                                {
                                                    $lt: [
                                                        computed,
                                                        "$regularPrice"
                                                    ]
                                                },
                                                computed,
                                                null
                                            ]
                                        },
                                        {
                                            $cond: [
                                                {
                                                    $lt: [
                                                        computed,
                                                        "$salePrice"
                                                    ]
                                                },
                                                computed,
                                                "$salePrice"
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        callForPrice: false
                    }
                }
            ]);

            return res.redirect("/admin/products");
        } else {
            return res.status(400).send(
                "Unknown bulk action."
            );
        }

        await Product.updateMany(filter, {
            $set: update
        });

        return res.redirect("/admin/products");
    } catch (error) {
        console.error(
            "Bulk Update Products Error:",
            error
        );

        return res.status(500).send(
            "Unable to update selected products."
        );
    }
};

// ======================================================
// ADMIN - ADD PRODUCT PAGE
// ======================================================

exports.getAddProductPage = async (
    req,
    res
) => {
    try {
        const flatCategories = await Category.find({
            isActive: {
                $ne: false,
            },
        })
            .sort({
                sortOrder: 1,
                name: 1,
            })
            .lean();

        const attrRegistry = await Attribute.find({})
            .sort({ key: 1 })
            .lean();

        const { tree } = buildTree(flatCategories);

        return res.render(
            "admin/addProduct",
            {
                pageTitle: "Add Product",
                categories: tree,
                attrRegistry,
            }
        );
    } catch (error) {
        console.error(
            "Get Add Product Page Error:",
            error
        );

        return res.status(500).send(
            "Unable to load add product page."
        );
    }
};

// ======================================================
// ADMIN - ADD PRODUCT
// ======================================================

exports.postAddProduct = async (
    req,
    res
) => {
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
            specs,
            specKey,
            specValue,
            rewardPoints,
            isNewArrival,
            isActive,
        } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).send(
                "Product title is required."
            );
        }

        const productSlug =
            await uniqueProductSlug(
                slug || title
            );

        const productSku =
            await uniqueSku(sku);

        const mainImages =
            getUploadedFiles(
                req.files,
                "mainImage"
            );

        const galleryImages =
            getUploadedFiles(
                req.files,
                "galleryImages"
            );

        const product = new Product({
            title: String(title).trim(),

            slug: productSlug,

            sku: productSku,

            mainCategory:
                mainCategory || "",

            subCategory:
                subCategory || "",

            childCategory:
                childCategory || "",

            brand:
                String(brand || "").trim(),

            regularPrice:
                toPrice(regularPrice),

            salePrice:
                toPrice(salePrice),

            callForPrice:
                callForPrice === "on" ||
                callForPrice === "true" ||
                callForPrice === true,

            rewardPoints:
                toPoints(rewardPoints),

            stockStatus:
                stockStatus || "In Stock",

            isNewArrival:
                isNewArrival === "on" ||
                isNewArrival === "true" ||
                isNewArrival === true,

            isActive:
                isActive === "on" ||
                isActive === "true" ||
                isActive === true,

            shortDesc:
                sanitizeHtml(shortDesc),

            longDesc:
                sanitizeHtml(longDesc),

            specs:
                parseSpecs(specs, specKey, specValue),

            mainImage:
                mainImages[0] || "",

            galleryImages,
        });

        await product.save();

        return res.redirect(
            "/admin/products"
        );
    } catch (error) {
        console.error(
            "Post Add Product Error:",
            error
        );

        if (error.code === 11000) {
            return res.status(400).send(
                "Product SKU or slug already exists."
            );
        }

        return res.status(500).send(
            "Unable to add product."
        );
    }
};

// ======================================================
// ADMIN - EDIT PRODUCT PAGE
// ======================================================

exports.getEditProductPage = async (
    req,
    res
) => {
    try {
        const product =
            await Product.findById(
                req.params.id
            ).lean();

        if (!product) {
            return res.status(404).send(
                "Product not found."
            );
        }

        const flatCategories =
            await Category.find({
                isActive: {
                    $ne: false,
                },
            })
                .sort({
                    sortOrder: 1,
                    name: 1,
                })
                .lean();

        const { tree } = buildTree(flatCategories);

        const attrRegistry = await Attribute.find({})
            .sort({ key: 1 })
            .lean();

        return res.render(
            "admin/editProduct",
            {
                product,
                categories: tree,
                attrRegistry,
                pageTitle: "Edit Product",
            }
        );
    } catch (error) {
        console.error(
            "Get Edit Product Page Error:",
            error
        );

        return res.status(500).send(
            "Unable to load edit product page."
        );
    }
};

// ======================================================
// ADMIN - EDIT PRODUCT
// ======================================================

exports.postEditProduct = async (
    req,
    res
) => {
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
            specs,
            specKey,
            specValue,
            rewardPoints,
            isNewArrival,
            isActive,
        } = req.body;

        if (
            !title ||
            !String(title).trim()
        ) {
            return res.status(400).send(
                "Product title is required."
            );
        }

        // ----------------------------------------------
        // BASIC FIELDS
        // ----------------------------------------------

        product.title =
            String(title).trim();

        product.slug =
            await uniqueProductSlug(
                slug || title,
                product._id
            );

        product.sku =
            await uniqueSku(
                sku || product.sku,
                product._id
            );

        product.mainCategory =
            mainCategory || "";

        product.subCategory =
            subCategory || "";

        product.childCategory =
            childCategory || "";

        product.brand =
            String(brand || "").trim();

        product.regularPrice =
            toPrice(regularPrice);

        product.salePrice =
            toPrice(salePrice);

        product.callForPrice =
            callForPrice === "on" ||
            callForPrice === "true" ||
            callForPrice === true;

        product.rewardPoints =
            toPoints(rewardPoints);

        product.stockStatus =
            stockStatus || "In Stock";

        product.isNewArrival =
            isNewArrival === "on" ||
            isNewArrival === "true" ||
            isNewArrival === true;

        product.isActive =
            isActive === "on" ||
            isActive === "true" ||
            isActive === true;

        product.shortDesc =
            sanitizeHtml(shortDesc);

        product.longDesc =
            sanitizeHtml(longDesc);

        product.specs =
            parseSpecs(specs, specKey, specValue);

        // ----------------------------------------------
        // IMAGES — the form's image manager posts the full
        // tile order (galleryOrdered=1): surviving existing
        // URLs + newly uploaded files.
        // ----------------------------------------------

        const newMainImages =
            getUploadedFiles(
                req.files,
                "mainImage"
            );

        const newGalleryImages =
            getUploadedFiles(
                req.files,
                "galleryImages"
            );

        if (req.body.galleryOrdered === "1") {
            const owned = new Set(
                []
                    .concat(product.galleryImages || [], [product.mainImage])
                    .filter(Boolean)
            );

            const kept =
                splitImageList(
                    req.body.existingImagesJoined
                ).filter((url) => owned.has(url));

            product.galleryImages = [
                ...kept,
                ...newGalleryImages,
            ];

            if (newMainImages.length) {
                product.mainImage =
                    newMainImages[0];
            } else {
                const keep = String(
                    req.body.mainImageKeep || ""
                ).trim();

                product.mainImage =
                    keep && owned.has(keep)
                        ? keep
                        : kept[0] ||
                          newGalleryImages[0] ||
                          "";
            }
        } else {
            // Legacy path (clients without the image manager).
            if (newMainImages.length) {
                product.mainImage =
                    newMainImages[0];
            }

            if (newGalleryImages.length) {
                const existingGallery =
                    Array.isArray(
                        product.galleryImages
                    )
                        ? product.galleryImages
                        : [];

                product.galleryImages = [
                    ...existingGallery,
                    ...newGalleryImages,
                ];
            }
        }

        await product.save();

        return res.redirect(
            "/admin/products"
        );
    } catch (error) {
        console.error(
            "Post Edit Product Error:",
            error
        );

        if (error.code === 11000) {
            return res.status(400).send(
                "Product SKU or slug already exists."
            );
        }

        return res.status(500).send(
            "Unable to update product."
        );
    }
};

// ======================================================
// ADMIN - DELETE PRODUCT
// ======================================================

exports.deleteProduct = async (
    req,
    res
) => {
    try {
        const product =
            await Product.findByIdAndDelete(
                req.params.id
            );

        if (!product) {
            return res.status(404).send(
                "Product not found."
            );
        }

        if (
            req.headers.accept &&
            req.headers.accept.includes(
                "application/json"
            )
        ) {
            return res.json({
                success: true,
                message:
                    "Product deleted successfully.",
            });
        }

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

// ======================================================
// ADMIN - DUPLICATE PRODUCT
// ======================================================

exports.duplicateProduct = async (
    req,
    res
) => {
    try {
        const original =
            await Product.findById(
                req.params.id
            ).lean();

        if (!original) {
            return res.status(404).send(
                "Product not found."
            );
        }

        const duplicateData = {
            ...original,
        };

        delete duplicateData._id;
        delete duplicateData.createdAt;
        delete duplicateData.updatedAt;

        duplicateData.title =
            `${original.title} Copy`;

        let duplicate = null;
        let lastError = null;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                duplicateData.slug =
                    await uniqueProductSlug(
                        `${original.slug}-copy`
                    );

                duplicateData.sku =
                    await uniqueSku();

                duplicate =
                    new Product(
                        duplicateData
                    );

                await duplicate.save();

                lastError = null;
                break;
            } catch (error) {
                lastError = error;
                duplicate = null;

                // A parallel click can claim the slug/SKU first — retry with
                // freshly generated values instead of failing the request.
                if (error.code !== 11000) break;
            }
        }

        if (!duplicate) {
            throw lastError || new Error(
                "Duplicate could not be created."
            );
        }

        return res.redirect(
            `/admin/products?duplicated=${duplicate._id}`
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

// ======================================================
// ADMIN - QUESTIONS
// ======================================================

exports.getAdminQuestions = async (
    req,
    res
) => {
    try {
        const products =
            await Product.find({
                "questions.0": {
                    $exists: true,
                },
            })
                .sort({
                    createdAt: -1,
                })
                .lean();

        const rows = [];

        for (const product of products) {
            for (const question of
                product.questions || []) {
                rows.push({
                    questionId: question._id,
                    productId: product._id,
                    productTitle: product.title,
                    productSlug: product.slug,
                    name: question.name,
                    question: question.question,
                    answer: question.answer || "",
                    isApproved: question.isApproved,
                    createdAt: question.createdAt,
                });
            }
        }

        rows.sort(
            (a, b) =>
                new Date(b.createdAt || 0) -
                new Date(a.createdAt || 0)
        );

        return res.render(
            "admin/questions",
            {
                rows,
                pageTitle: "Questions",
            }
        );
    } catch (error) {
        console.error(
            "Get Admin Questions Error:",
            error
        );

        return res.status(500).send(
            "Unable to load questions."
        );
    }
};

// ======================================================
// ADMIN - ANSWER QUESTION
// ======================================================

exports.postAnswerQuestion = async (
    req,
    res
) => {
    try {
        const {
            productId,
            questionId,
            answer,
        } = req.body;

        if (!productId || !questionId) {
            return res.status(400).send(
                "Product and question are required."
            );
        }

        const product =
            await Product.findById(
                productId
            );

        if (!product) {
            return res.status(404).send(
                "Product not found."
            );
        }

        const question =
            product.questions.id(
                questionId
            );

        if (!question) {
            return res.status(404).send(
                "Question not found."
            );
        }

        question.answer =
            String(answer || "").trim();

        await product.save();

        return res.redirect(
            "/admin/questions"
        );
    } catch (error) {
        console.error(
            "Post Answer Question Error:",
            error
        );

        return res.status(500).send(
            "Unable to answer question."
        );
    }
};

// ======================================================
// ADMIN - TOGGLE QUESTION APPROVAL
// ======================================================

exports.getToggleQuestionApproval =
    async (req, res) => {
        try {
            const {
                productId,
                questionId,
            } = req.params;

            const product =
                await Product.findById(
                    productId
                );

            if (!product) {
                return res.status(404).send(
                    "Product not found."
                );
            }

            const question =
                product.questions.id(
                    questionId
                );

            if (!question) {
                return res.status(404).send(
                    "Question not found."
                );
            }

            question.isApproved =
                !question.isApproved;

            await product.save();

            return res.redirect(
                "/admin/questions"
            );
        } catch (error) {
            console.error(
                "Toggle Question Approval Error:",
                error
            );

            return res.status(500).send(
                "Unable to update question."
            );
        }
    };

// ======================================================
// ADMIN - DELETE QUESTION
// ======================================================

exports.getDeleteQuestion =
    async (req, res) => {
        try {
            const {
                productId,
                questionId,
            } = req.params;

            const product =
                await Product.findById(
                    productId
                );

            if (!product) {
                return res.status(404).send(
                    "Product not found."
                );
            }

            const question =
                product.questions.id(
                    questionId
                );

            if (!question) {
                return res.status(404).send(
                    "Question not found."
                );
            }

            question.deleteOne();

            await product.save();

            return res.redirect(
                "/admin/questions"
            );
        } catch (error) {
            console.error(
                "Delete Question Error:",
                error
            );

            return res.status(500).send(
                "Unable to delete question."
            );
        }
    };

// ======================================================
// STOREFRONT - SINGLE PRODUCT
// ======================================================

exports.getSingleProduct = async (
    req,
    res
) => {
    try {
        const product =
            await Product.findOne({
                slug: req.params.slug,
                isActive: {
                    $ne: false,
                },
            }).lean();

        if (!product) {
            return res.status(404).render(
                "errors/404",
                {
                    pageTitle:
                        "Product Not Found",
                }
            );
        }

        let similarProducts = [];

        if (product.mainCategory) {
            const baseFilter = {
                _id: {
                    $ne: product._id,
                },
                mainCategory:
                    product.mainCategory,
                isActive: {
                    $ne: false,
                },
            };

            const sameBrand = product.brand
                ? await Product.find(
                      Object.assign(
                          {},
                          baseFilter,
                          { brand: product.brand }
                      )
                  )
                      .sort({
                          stockRank: 1,
                          createdAt: -1,
                      })
                      .limit(5)
                      .lean()
                : [];

            const sameCategory =
                await Product.find(baseFilter)
                    .sort({
                        stockRank: 1,
                        createdAt: -1,
                    })
                    .limit(10)
                    .lean();

            const seen =
                new Set();

            sameBrand
                .concat(sameCategory)
                .forEach(function (item) {
                    const key =
                        String(item._id);

                    if (
                        seen.has(key) ||
                        similarProducts.length >= 5
                    ) {
                        return;
                    }

                    seen.add(key);
                    similarProducts.push(
                        item
                    );
                });
        }

        const allCategories = await Category.find({})
            .select("name slug parent")
            .lean();

        const crumbTrail = productCategoryTrail(allCategories, product);

        return res.render(
            "singleProduct",
            {
                product,
                similarProducts,
                categorySlug: crumbTrail.length
                    ? crumbTrail[0].slug
                    : "",
                categoryTrail: crumbTrail,
                pageTitle: product.title,
            }
        );
    } catch (error) {
        console.error(
            "Get Single Product Error:",
            error
        );

        return res.status(500).send(
            "Unable to load product."
        );
    }
};

// ======================================================
// STOREFRONT - PRODUCT REVIEW
// ======================================================

exports.postProductReview = async (
    req,
    res
) => {
    try {
        const {
            name,
            rating,
            comment,
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

        const numericRating =
            Number(rating);

        if (
            !Number.isFinite(
                numericRating
            ) ||
            numericRating < 1 ||
            numericRating > 5
        ) {
            return res.status(400).send(
                "Rating must be between 1 and 5."
            );
        }

        product.reviews.push({
            name:
                String(name || "").trim(),
            rating: numericRating,
            comment:
                String(comment || "").trim(),
            isApproved: false,
        });

        await product.save();

        return res.redirect("back");
    } catch (error) {
        console.error(
            "Post Product Review Error:",
            error
        );

        return res.status(500).send(
            "Unable to submit review."
        );
    }
};

// ======================================================
// STOREFRONT - PRODUCT QUESTION
// ======================================================

exports.postProductQuestion = async (
    req,
    res
) => {
    try {
        const {
            name,
            question,
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

        if (
            !String(question || "").trim()
        ) {
            return res.status(400).send(
                "Question is required."
            );
        }

        product.questions.push({
            name:
                String(name || "").trim(),
            question:
                String(question).trim(),
            answer: "",
            isApproved: false,
        });

        await product.save();

        return res.redirect("back");
    } catch (error) {
        console.error(
            "Post Product Question Error:",
            error
        );

        return res.status(500).send(
            "Unable to submit question."
        );
    }
};

// ======================================================
// ADMIN - UPLOAD IMAGE
// ======================================================

exports.postUploadImage = async (
    req,
    res
) => {
    try {
        const image =
            getUploadedFiles(
                req.files,
                "image"
            );

        const images =
            image.length
                ? image
                : getUploadedFiles(
                      req.files,
                      "mainImage"
                  );

        /* upload.single("image") puts the file on req.file, not req.files. */
        if (!images.length && req.file) {
            const single = getFileUrl(req.file);

            if (single) images.push(single);
        }

        if (!images.length) {
            return res.status(400).json({
                success: false,
                message:
                    "No image uploaded.",
            });
        }

        return res.json({
            success: true,
            url: images[0],
            image: images[0],
        });
    } catch (error) {
        console.error(
            "Upload Image Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to upload image.",
        });
    }
};

// ======================================================
// ADMIN - UPLOAD MEDIA
// ======================================================

exports.postUploadMedia = async (
    req,
    res
) => {
    try {
        const files = [];

        if (req.files) {
            for (const field of Object.keys(
                req.files
            )) {
                files.push(
                    ...getUploadedFiles(
                        req.files,
                        field
                    )
                );
            }
        }

        if (!files.length && req.file) {
            const url =
                getFileUrl(req.file);

            if (url) {
                files.push(url);
            }
        }

        if (!files.length) {
            return res.status(400).json({
                success: false,
                message:
                    "No media uploaded.",
            });
        }

        return res.json({
            success: true,
            urls: files,
            files,
        });
    } catch (error) {
        console.error(
            "Upload Media Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to upload media.",
        });
    }
};