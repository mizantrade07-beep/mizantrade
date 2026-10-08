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
           IMAGE (Cloudinary Support)
        ------------------------------------------------ */

        let mainImage = "";
        let galleryImages = [];

        if (req.files) {
            if (req.files.mainImage && req.files.mainImage.length > 0) {
        const file = req.files.mainImage[0];
        mainImage = file.path || file.secure_url || "";
        }
        
        if (req.files.galleryImages && req.files.galleryImages.length > 0) {
        galleryImages = req.files.galleryImages.map(
            (file) => file.path || file.secure_url || ""
        ).filter(Boolean);
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
            mainCategory: mainCategory.trim(),
            subCategory: subCategory ? subCategory.trim() : "",
            childCategory: childCategory ? childCategory.trim() : "",
            brand: brand ? brand.trim() : "",
            regularPrice: toPrice(regularPrice),
            salePrice: toPrice(salePrice),
            callForPrice: callForPrice === "true" || callForPrice === "on",
            stockStatus: stockStatus || "In Stock",
            mainImage,
            galleryImages,
            shortDesc: sanitizeHtml(shortDesc),
            longDesc: sanitizeHtml(longDesc),
            specs: specList,
            isActive: isActive === "on" || isActive === "true"
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
               MAIN IMAGE (Cloudinary Support)
            ------------------------------------------- */

            if (
                req.files &&
                req.files.mainImage &&
                req.files.mainImage.length > 0
            ) {
                const file = req.files.mainImage[0];
                updateData.mainImage = file.path || file.secure_url || ("/uploads/" + file.filename);
            }


            /* -------------------------------------------
               GALLERY (Cloudinary Support)
            ------------------------------------------- */

            if (
                req.files &&
                req.files.galleryImages &&
                req.files.galleryImages.length > 0
            ) {
                updateData.galleryImages =
                    req.files.galleryImages.map(
                        (file) =>
                            file.path || file.secure_url || ("/uploads/" + file.filename)
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

    const fileUrl = req.file.path || req.file.secure_url || ("/uploads/" + req.file.filename);

    return res.json({
        success: true,
        url: fileUrl
    });
};


exports.postUploadMedia = (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No file received."
        });
    }

    const fileUrl = req.file.path || req.file.secure_url || ("/uploads/" + req.file.filename);

    return res.json({
        success: true,
        url: fileUrl,
        type: req.file.mimetype.indexOf("video/") === 0 ? "video" : "image"
    });
};