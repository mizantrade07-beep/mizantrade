const mongoose = require("mongoose");
const mammoth = require("mammoth");
const ExcelJS = require("exceljs");

const Offer = require("../models/Offer");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { sanitizeRichHtml } = require("../utils/richHtml");
const { offerPriceLabel } = require("../utils/offers");

/* ======================================================
   SMALL HELPERS
====================================================== */

function toStringArray(value) {
    if (Array.isArray(value)) {
        return value.map(function (item) {
            return String(item == null ? "" : item).trim();
        });
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map(function (item) {
                return item.trim();
            });
    }
    return [];
}

function uniqueStrings(list) {
    const seen = new Set();
    const out = [];
    (list || []).forEach(function (item) {
        if (item && !seen.has(item)) {
            seen.add(item);
            out.push(item);
        }
    });
    return out;
}

function decorateCategories(categories) {
    const bySlug = new Map();
    const byName = new Map();

    (categories || []).forEach(function (cat) {
        bySlug.set(cat.slug, cat);
        if (!byName.has(cat.name)) byName.set(cat.name, cat);
    });

    return (categories || []).map(function (cat) {
        const chain = [];
        const seen = new Set();
        let current = cat;

        while (current) {
            chain.unshift(current);
            if (!current.parent || seen.has(current.slug)) break;
            seen.add(current.slug);
            current = bySlug.get(current.parent);
        }

        return {
            slug: cat.slug,
            name: cat.name,
            parent: cat.parent || "",
            level: chain.length,
            path: chain
                .map(function (node) {
                    return node.name;
                })
                .join(" › ")
        };
    });
}

function productScopeSlugs(product, byName, bySlug) {
    const slugs = [];
    const seen = new Set();

    function addCategory(cat) {
        if (!cat) return;
        const chainSeen = new Set();
        let current = cat;
        while (current) {
            if (!seen.has(current.slug)) {
                seen.add(current.slug);
                slugs.push(current.slug);
            }
            if (!current.parent || chainSeen.has(current.slug)) break;
            chainSeen.add(current.slug);
            current = bySlug.get(current.parent);
        }
    }

    addCategory(byName.get(product.mainCategory) || bySlug.get(product.mainCategory));
    addCategory(byName.get(product.subCategory) || bySlug.get(product.subCategory));
    addCategory(byName.get(product.childCategory) || bySlug.get(product.childCategory));

    return slugs;
}

async function loadFormData(offer) {
    const [categories, products, offerTypes] = await Promise.all([
        Category.find({}).sort({ order: 1, name: 1 }).lean(),
        Product.find({})
            .select("title sku mainCategory subCategory childCategory")
            .sort({ title: 1 })
            .lean(),
        Offer.distinct("type")
    ]);

    const decorated = decorateCategories(categories);

    const byName = new Map();
    const bySlug = new Map();
    categories.forEach(function (cat) {
        bySlug.set(cat.slug, cat);
        if (!byName.has(cat.name)) byName.set(cat.name, cat);
    });

    const categoryOptions = decorated.map(function (cat) {
        return cat;
    });

    const productOptions = products.map(function (product) {
        return {
            id: String(product._id),
            title: product.title,
            sku: product.sku || "",
            mainCategory: product.mainCategory || "",
            subCategory: product.subCategory || "",
            childCategory: product.childCategory || "",
            scopeSlugs: productScopeSlugs(product, byName, bySlug)
        };
    });

    const selected = {
        categories: (offer && offer.categories) || [],
        subCategories: (offer && offer.subCategories) || [],
        childCategories: (offer && offer.childCategories) || [],
        products: ((offer && offer.products) || []).map(function (id) {
            return String(id);
        })
    };

    return {
        categoryOptions: categoryOptions,
        productOptions: productOptions,
        offerTypes: uniqueStrings(offerTypes).sort(function (a, b) {
            return a.localeCompare(b);
        }),
        selected: selected
    };
}

/* ======================================================
   ADMIN - LIST
====================================================== */

exports.getOffers = async (req, res) => {
    try {
        const typeFilter = String(req.query.type || "").trim();
        const filter = {};
        if (typeFilter) filter.type = typeFilter;

        const [offers, offerTypes, categories, total, active, hidden, withBanner] =
            await Promise.all([
                Offer.find(filter).sort({ type: 1, order: 1, createdAt: 1 }).lean(),
                Offer.distinct("type"),
                Category.find({}).select("slug name parent").lean(),
                Offer.countDocuments({}),
                Offer.countDocuments({ isActive: true }),
                Offer.countDocuments({ isActive: false }),
                Offer.countDocuments({
                    banner: { $exists: true, $nin: ["", null] }
                })
            ]);

        const catBySlug = new Map();
        categories.forEach(function (cat) {
            catBySlug.set(cat.slug, cat.name);
        });

        const productIds = [];
        offers.forEach(function (offer) {
            (offer.products || []).forEach(function (id) {
                productIds.push(String(id));
            });
        });

        const productDocs = productIds.length
            ? await Product.find({ _id: { $in: uniqueStrings(productIds) } })
                  .select("title")
                  .lean()
            : [];

        const productTitles = new Map();
        productDocs.forEach(function (product) {
            productTitles.set(String(product._id), product.title);
        });

        offers.forEach(function (offer) {
            const labels = [];

            (offer.categories || []).forEach(function (slug) {
                labels.push(catBySlug.get(slug) || slug);
            });
            (offer.subCategories || []).forEach(function (slug) {
                labels.push("↳ " + (catBySlug.get(slug) || slug));
            });
            (offer.childCategories || []).forEach(function (slug) {
                labels.push("↳↳ " + (catBySlug.get(slug) || slug));
            });
            (offer.products || []).forEach(function (id) {
                labels.push(productTitles.get(String(id)) || "Product");
            });

            offer.scopeLabels = labels;
            offer.priceLabel = offerPriceLabel(offer.price);
            offer.hasContent = Boolean(String(offer.content || "").trim());
            offer.hasBanner = Boolean(String(offer.banner || "").trim());
        });

        const cleanTypes = uniqueStrings(offerTypes)
            .filter(Boolean)
            .sort(function (a, b) {
                return a.localeCompare(b);
            });

        return res.render("admin/offers", {
            pageTitle: "Offers Manager",
            offers,
            counts: {
                total,
                active,
                hidden,
                withBanner,
                types: cleanTypes.length
            },
            offerTypes: cleanTypes,
            typeFilter
        });
    } catch (error) {
        console.error("Admin offers list error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - ADD / EDIT
====================================================== */

exports.getAddOfferPage = async (req, res) => {
    try {
        const data = await loadFormData(null);

        return res.render("admin/offerForm", {
            pageTitle: "Add Offer",
            offer: null,
            categoryOptions: data.categoryOptions,
            productOptions: data.productOptions,
            offerTypes: data.offerTypes,
            selected: data.selected
        });
    } catch (error) {
        console.error("Add offer page error:", error);
        return res.status(500).render("errors/500");
    }
};

function parseOfferBody(body) {
    const type = String(body.type || "").trim() || "Product";
    const name = String(body.name || "").trim();

    const products = uniqueStrings(toStringArray(body.products)).filter(function (id) {
        return mongoose.isValidObjectId(id);
    });

    let banner = String(body.banner || "").trim();
    if (banner && !/^(https?:\/\/|\/uploads\/|\/images\/)/i.test(banner)) {
        banner = "";
    }

    const layoutOptions = ["full", "half", "third", "quarter"];
    const layoutValue = String(body.layout || "").trim();
    const layout = layoutOptions.indexOf(layoutValue) !== -1
        ? layoutValue
        : "full";

    return {
        type: type,
        name: name,
        offerQty: String(body.offerQty || "").trim(),
        price: String(body.price || "").trim(),
        gift: String(body.gift || "").trim(),
        order: Number(body.order) || 0,
        layout: layout,
        isActive: body.isActive === "on" || body.isActive === "true",
        categories: uniqueStrings(toStringArray(body.categories)),
        subCategories: uniqueStrings(toStringArray(body.subCategories)),
        childCategories: uniqueStrings(toStringArray(body.childCategories)),
        products: products,
        banner: banner,
        content: sanitizeRichHtml(body.content)
    };
}

exports.postAddOffer = async (req, res) => {
    try {
        const data = parseOfferBody(req.body);

        if (!data.name) {
            return res.status(400).send("Offer name is required.");
        }

        await Offer.create(data);

        return res.redirect("/admin/offers");
    } catch (error) {
        console.error("Add offer error:", error);
        return res.status(500).send("Unable to create offer.");
    }
};

exports.getEditOfferPage = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).send("Offer not found.");
        }

        const offer = await Offer.findById(req.params.id).lean();
        if (!offer) {
            return res.status(404).send("Offer not found.");
        }

        const data = await loadFormData(offer);

        return res.render("admin/offerForm", {
            pageTitle: "Edit Offer",
            offer,
            categoryOptions: data.categoryOptions,
            productOptions: data.productOptions,
            offerTypes: data.offerTypes,
            selected: data.selected
        });
    } catch (error) {
        console.error("Edit offer load error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.postEditOffer = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).send("Offer not found.");
        }

        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            return res.status(404).send("Offer not found.");
        }

        const data = parseOfferBody(req.body);

        if (!data.name) {
            return res.status(400).send("Offer name is required.");
        }

        Object.assign(offer, data);
        await offer.save();

        return res.redirect("/admin/offers");
    } catch (error) {
        console.error("Edit offer error:", error);
        return res.status(500).send("Unable to update offer.");
    }
};

/* ======================================================
   ADMIN - TOGGLE + DELETE
====================================================== */

exports.toggleOffer = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            return res.status(404).send("Offer not found.");
        }

        offer.isActive = !offer.isActive;
        await offer.save();

        return res.redirect("/admin/offers");
    } catch (error) {
        console.error("Toggle offer error:", error);
        return res.status(500).send("Unable to update the offer.");
    }
};

exports.deleteOffer = async (req, res) => {
    try {
        await Offer.findByIdAndDelete(req.params.id);
        return res.redirect("/admin/offers");
    } catch (error) {
        console.error("Delete offer error:", error);
        return res.status(500).send("Unable to delete offer.");
    }
};

/* ======================================================
   WORD / EXCEL IMPORT
====================================================== */

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function excelDateText(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toISOString().slice(0, 10);
}

function excelCellValue(cell) {
    const value = cell ? cell.value : null;

    if (value === null || value === undefined) {
        return { text: "", formula: "" };
    }

    if (value instanceof Date) {
        return { text: excelDateText(value), formula: "" };
    }

    if (typeof value !== "object") {
        return { text: String(value), formula: "" };
    }

    if (value.formula || value.sharedFormula) {
        const formula = "=" + (value.formula || value.sharedFormula);
        let result = value.result;

        if (result && typeof result === "object" && result.error) {
            return { text: "#" + result.error, formula: formula };
        }
        if (result instanceof Date) result = excelDateText(result);
        if (result && typeof result === "object" && result.richText) {
            result = result.richText
                .map(function (part) {
                    return part.text;
                })
                .join("");
        }
        if (result !== null && result !== undefined && typeof result === "object") {
            result = result.text !== undefined ? result.text : "";
        }

        return {
            text: result === null || result === undefined ? "" : String(result),
            formula: formula
        };
    }

    if (value.richText) {
        return {
            text: value.richText
                .map(function (part) {
                    return part.text;
                })
                .join(""),
            formula: ""
        };
    }

    if (value.error) {
        return { text: "#" + value.error, formula: "" };
    }

    if (value.text !== undefined && value.text !== null) {
        return { text: String(value.text), formula: "" };
    }

    return { text: String(value), formula: "" };
}

const MAX_IMPORT_ROWS = 400;
const MAX_IMPORT_COLS = 40;

function worksheetToHtml(worksheet) {
    const rowCount = Math.min(
        Math.max(worksheet.rowCount || 0, worksheet.actualRowCount || 0),
        MAX_IMPORT_ROWS
    );
    const colCount = Math.min(
        Math.max(worksheet.columnCount || 0, worksheet.actualColumnCount || 0),
        MAX_IMPORT_COLS
    );

    if (!rowCount || !colCount) return "";

    const parts = ['<table class="rte-table"><tbody>'];

    for (let r = 1; r <= rowCount; r++) {
        const row = worksheet.getRow(r);
        parts.push("<tr>");

        for (let c = 1; c <= colCount; c++) {
            const cell = row.getCell(c);
            const parsed = excelCellValue(cell);

            const attrs = [];
            const styles = [];

            if (parsed.formula) {
                attrs.push('data-formula="' + escapeHtml(parsed.formula) + '"');
            }

            if (cell.font && cell.font.bold) {
                styles.push("font-weight:700");
            }

            const align =
                cell.alignment && cell.alignment.horizontal
                    ? String(cell.alignment.horizontal)
                    : "";
            if (align && ["left", "center", "right", "justify"].indexOf(align) !== -1) {
                styles.push("text-align:" + align);
            }

            if (styles.length) {
                attrs.push('style="' + styles.join("; ") + '"');
            }

            const text = escapeHtml(parsed.text).replace(/\r?\n/g, "<br>");

            parts.push(
                "<td" +
                    (attrs.length ? " " + attrs.join(" ") : "") +
                    ">" +
                    text +
                    "</td>"
            );
        }

        parts.push("</tr>");
    }

    parts.push("</tbody></table>");
    return parts.join("");
}

async function workbookToHtml(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheets = [];
    workbook.eachSheet(function (worksheet) {
        const html = worksheetToHtml(worksheet);
        if (html) {
            sheets.push({
                name: worksheet.name,
                html: html
            });
        }
    });

    if (!sheets.length) return "";

    const multi = sheets.length > 1;
    return sheets
        .map(function (sheet) {
            return (
                (multi ? "<h3>" + escapeHtml(sheet.name) + "</h3>" : "") +
                sheet.html
            );
        })
        .join("<p><br></p>");
}

exports.postImportFile = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: "Choose a .docx or .xlsx file."
            });
        }

        const ext = String(req.file.originalname || "")
            .toLowerCase()
            .split(".")
            .pop();

        let html = "";

        if (ext === "docx") {
            const result = await mammoth.convertToHtml({
                buffer: req.file.buffer
            });
            html = result.value || "";
        } else if (ext === "xlsx") {
            html = await workbookToHtml(req.file.buffer);
        } else {
            return res.status(400).json({
                success: false,
                message: "Only .docx and .xlsx files can be imported."
            });
        }

        html = sanitizeRichHtml(html);

        if (!html.trim()) {
            return res.status(400).json({
                success: false,
                message:
                    "No readable content was found in this file. Try a different file or paste the content directly."
            });
        }

        if (html.length > 3 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message:
                    "The imported content is too large (over 3 MB). Please split the file."
            });
        }

        return res.json({
            success: true,
            html: html,
            fileName: req.file.originalname
        });
    } catch (error) {
        console.error("Offer import error:", error);
        return res.status(500).json({
            success: false,
            message:
                "Could not read this file. Please make sure it is a valid .docx or .xlsx file."
        });
    }
};
