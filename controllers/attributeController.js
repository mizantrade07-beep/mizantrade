const Attribute = require("../models/Attribute");

/* Accept a comma / newline separated list and return clean unique values. */
function parseValues(raw) {
    return String(raw || "")
        .split(/[\n,]/)
        .map(function (v) { return v.trim(); })
        .filter(Boolean)
        .filter(function (v, i, arr) { return arr.indexOf(v) === i; });
}

/* ======================================================
   ADMIN - ATTRIBUTE LIST / MANAGER (GET)
====================================================== */

exports.getAttributes = async (req, res) => {
    try {
        let editAttribute = null;

        if (req.query.edit) {
            editAttribute = await Attribute.findById(req.query.edit).lean();
        }

        const attributes = await Attribute.find({})
            .sort({ key: 1 })
            .lean();

        return res.render("admin/attributes", {
            pageTitle: "Filter Attributes",
            attributes,
            editAttribute,
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getAttributes error:", error.message);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - CREATE / UPDATE ATTRIBUTE (POST)
====================================================== */

exports.postSaveAttribute = async (req, res) => {
    try {
        const id = String(req.body.id || "").trim();
        const key = String(req.body.key || "").trim();
        const values = parseValues(req.body.values);

        if (!key) {
            return res.redirect("/admin/attributes?message=empty");
        }

        if (id) {
            await Attribute.findByIdAndUpdate(
                id,
                { key, values },
                { runValidators: true }
            );
        } else {
            // Upsert on the unique key so re-adding merges values instead
            // of throwing a duplicate-key error.
            await Attribute.findOneAndUpdate(
                { key },
                { $setOnInsert: { key }, $addToSet: { values: { $each: values } } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        return res.redirect("/admin/attributes?message=saved");
    } catch (error) {
        console.error("postSaveAttribute error:", error.message);
        return res.redirect("/admin/attributes?message=error");
    }
};

/* ======================================================
   ADMIN - DELETE ATTRIBUTE (GET)
====================================================== */

exports.deleteAttribute = async (req, res) => {
    try {
        await Attribute.findByIdAndDelete(req.params.id);
        return res.redirect("/admin/attributes?message=deleted");
    } catch (error) {
        console.error("deleteAttribute error:", error.message);
        return res.redirect("/admin/attributes?message=error");
    }
};
