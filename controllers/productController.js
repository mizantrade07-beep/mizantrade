const Product = require("../models/Product");
const Category = require("../models/Category");

const {
    createSlug,
} = require("../utils/slug");

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

function parseSpecs(specs) {
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

// ======================================================
// ADMIN - PRODUCT LIST
// ======================================================

exports.getAdminProducts = async (req, res) => {
    try {
        const search = String(
            req.query.search || ""
        ).trim();

        const filter = {};

        if (search) {
            filter.$or = [
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
            ];
        }

        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        return res.render("admin/products", {
            products,
            search,
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
// ADMIN - ADD PRODUCT PAGE
// ======================================================

exports.getAddProductPage = async (
    req,
    res
) => {
    try {
        const categories = await Category.find({
            isActive: {
                $ne: false,
            },
        })
            .sort({
                sortOrder: 1,
                name: 1,
            })
            .lean();

        return res.render(
            "admin/addProduct",
            {
                pageTitle: "Add Product",
                categories,
                attrRegistry: [],
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

            stockStatus:
                stockStatus || "In Stock",

            shortDesc:
                sanitizeHtml(shortDesc),

            longDesc:
                sanitizeHtml(longDesc),

            specs:
                parseSpecs(specs),

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

        const categories =
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

        return res.render(
            "admin/editProduct",
            {
                product,
                categories,
                attrRegistry: [],
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

        product.stockStatus =
            stockStatus || "In Stock";

        product.shortDesc =
            sanitizeHtml(shortDesc);

        product.longDesc =
            sanitizeHtml(longDesc);

        product.specs =
            parseSpecs(specs);

        // ----------------------------------------------
        // MAIN IMAGE
        // ----------------------------------------------

        const newMainImages =
            getUploadedFiles(
                req.files,
                "mainImage"
            );

        if (newMainImages.length) {
            product.mainImage =
                newMainImages[0];
        }

        // ----------------------------------------------
        // GALLERY IMAGES
        // ----------------------------------------------

        const newGalleryImages =
            getUploadedFiles(
                req.files,
                "galleryImages"
            );

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

        duplicateData.slug =
            await uniqueProductSlug(
                `${original.slug}-copy`
            );

        duplicateData.sku =
            await uniqueSku();

        const duplicate =
            new Product(
                duplicateData
            );

        await duplicate.save();

        return res.redirect(
            "/admin/products"
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

        const questions = [];

        for (const product of products) {
            for (const question of
                product.questions || []) {
                questions.push({
                    ...question,
                    product: {
                        _id: product._id,
                        title: product.title,
                        slug: product.slug,
                    },
                });
            }
        }

        return res.render(
            "admin/questions",
            {
                questions,
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

        const similarProducts =
            await Product.find({
                _id: {
                    $ne: product._id,
                },
                mainCategory:
                    product.mainCategory,
                isActive: {
                    $ne: false,
                },
            })
                .sort({
                    createdAt: -1,
                })
                .limit(4)
                .lean();

        return res.render(
            "singleProduct",
            {
                product,
                similarProducts,
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