const Category = require("../models/Category");
const Product = require("../models/Product");

const {
    buildTree,
    collectDescendantSlugs
} = require("../utils/categoryTree");

function createSlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base, ignoreId) {
    let slug = base;
    let suffix = 2;

    while (true) {
        const query = { slug };

        if (ignoreId) {
            query._id = { $ne: ignoreId };
        }

        const exists = await Category.findOne(query).select("_id");

        if (!exists) {
            return slug;
        }

        slug = base + "-" + suffix;
        suffix++;
    }
}

function parseBrands(value) {
    const list = Array.isArray(value)
        ? value
        : String(value || "").split(",");

    return list
        .map((brand) => String(brand).trim())
        .filter(Boolean);
}

/* Product count: count main / sub / child categories into one map */
async function getProductCounts() {
    const [mainCounts, subCounts, childCounts] = await Promise.all([
        Product.aggregate([
            {
                $group: {
                    _id: "$mainCategory",
                    total: { $sum: 1 }
                }
            }
        ]),

        Product.aggregate([
            {
                $match: {
                    subCategory: { $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$subCategory",
                    total: { $sum: 1 }
                }
            }
        ]),

        Product.aggregate([
            {
                $match: {
                    childCategory: { $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$childCategory",
                    total: { $sum: 1 }
                }
            }
        ])
    ]);

    const counts = {};

    [...mainCounts, ...subCounts, ...childCounts].forEach((row) => {
        if (!row._id) {
            return;
        }

        counts[row._id] = (counts[row._id] || 0) + row.total;
    });

    return counts;
}

/* Convert nested tree into a flat list with levels */
function flattenTree(nodes, out) {
    out = out || [];

    nodes.forEach(function (node) {
        out.push(node);

        if (node.children && node.children.length) {
            flattenTree(node.children, out);
        }
    });

    return out;
}

/* Parent dropdown options: only level 1 and 2, so maximum 3 levels are allowed */
function buildParentOptions(flat, excludeSlugs) {
    const { tree } = buildTree(flat);
    const nodes = flattenTree(tree);
    const blocked = new Set(excludeSlugs || []);

    return nodes
        .filter(function (node) {
            return node.level < 3 && !blocked.has(node.slug);
        })
        .map(function (node) {
            const indent =
                node.level === 1
                    ? ""
                    : "\u00A0\u00A0\u00A0\u21B3 ";

            return {
                slug: node.slug,
                name: node.name,
                level: node.level,
                label: indent + node.name
            };
        });
}

/* ======================================================
   CATEGORY LIST
====================================================== */

exports.getCategories = async (req, res) => {
    try {
        const [categories, counts] = await Promise.all([
            Category.find({})
                .sort({ order: 1, name: 1 })
                .lean(),

            getProductCounts()
        ]);

        const { tree, orphans } = buildTree(categories);

        const subCount = tree.reduce(function (sum, top) {
            return sum + (top.children ? top.children.length : 0);
        }, 0);

        const childCount = tree.reduce(function (sum, top) {
            return sum + (top.children || []).reduce(function (s, sub) {
                return s + (sub.children ? sub.children.length : 0);
            }, 0);
        }, 0);

        return res.render("admin/categories", {
            pageTitle: "Categories",
            tree,
            orphans,
            counts,
            subCount,
            childCount,
            totalProducts: Object.values(counts).reduce(
                (a, b) => a + b,
                0
            )
        });
    } catch (error) {
        console.error("Admin category list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADD CATEGORY
====================================================== */

exports.getAddCategoryPage = async (req, res) => {
    try {
        const flat = await Category.find({})
            .sort({ order: 1, name: 1 })
            .lean();

        const parents = buildParentOptions(flat, []);

        return res.render("admin/categoryForm", {
            pageTitle: "Add Category",
            category: null,
            parents
        });
    } catch (error) {
        console.error("Add category page error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postAddCategory = async (req, res) => {
    try {
        const {
            name,
            slug,
            icon,
            parent,
            brands,
            showOnHome,
            order,
            isActive
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).send("Category name is required.");
        }

        const slugBase = createSlug(slug || name);

        if (!slugBase) {
            return res
                .status(400)
                .send("A valid category slug is required.");
        }

        await Category.create({
            name: name.trim(),
            slug: await uniqueSlug(slugBase),
            icon: (icon || "").trim() || "fa-solid fa-microchip",
            parent: (parent || "").trim(),
            brands: parseBrands(brands),
            showOnHome: showOnHome === "on",
            order: Number(order) || 0,
            isActive: isActive === "on"
        });

        return res.redirect("/admin/categories");
    } catch (error) {
        console.error("Add category error:", error);

        if (error.code === 11000) {
            return res
                .status(400)
                .send("This slug already exists.");
        }

        return res.status(500).send("Unable to add category.");
    }
};

/* ======================================================
   EDIT CATEGORY
====================================================== */

exports.getEditCategoryPage = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).lean();

        if (!category) {
            return res.status(404).send("Category not found.");
        }

        const flat = await Category.find({})
            .sort({ order: 1, name: 1 })
            .lean();

        // The category itself and its descendants cannot be selected as a parent to prevent cycles
        const blocked = collectDescendantSlugs(flat, category.slug);

        blocked.push(String(category._id));

        const parents = buildParentOptions(
            flat.filter(function (c) {
                return String(c._id) !== String(category._id);
            }),
            blocked
        );

        return res.render("admin/categoryForm", {
            pageTitle: "Edit Category",
            category,
            parents
        });
    } catch (error) {
        console.error("Edit category page error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postEditCategory = async (req, res) => {
    try {
        const {
            name,
            slug,
            icon,
            parent,
            brands,
            showOnHome,
            order,
            isActive
        } = req.body;

        const target = await Category.findById(req.params.id).lean();

        if (!target) {
            return res.status(404).send("Category not found.");
        }

        // A category cannot be assigned under itself or one of its descendants
        const flat = await Category.find({}).lean();

        const blocked = collectDescendantSlugs(
            flat,
            target.slug
        );

        let parentSlug = (parent || "").trim();

        if (
            parentSlug &&
            blocked.indexOf(parentSlug) !== -1
        ) {
            parentSlug = "";
        }

        await Category.findByIdAndUpdate(req.params.id, {
            name: name ? name.trim() : "",
            slug: await uniqueSlug(
                createSlug(slug || name),
                req.params.id
            ),
            icon:
                (icon || "").trim() ||
                "fa-solid fa-microchip",
            parent: parentSlug,
            brands: parseBrands(brands),
            showOnHome: showOnHome === "on",
            order: Number(order) || 0,
            isActive: isActive === "on"
        });

        return res.redirect("/admin/categories");
    } catch (error) {
        console.error("Edit category error:", error);

        if (error.code === 11000) {
            return res
                .status(400)
                .send("This slug already exists.");
        }

        return res
            .status(500)
            .send("Unable to update category.");
    }
};

/* ======================================================
   DELETE CATEGORY
====================================================== */

exports.deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);

        return res.redirect("/admin/categories");
    } catch (error) {
        console.error("Delete category error:", error);
        return res.status(500).send("Unable to delete category.");
    }
};