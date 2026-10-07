/* শেয়ার্ড slug হেল্পার — Page/Post/Category সবখানে ব্যবহারযোগ্য */

function createSlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(Model, base, ignoreId) {
    let slug = base;
    let suffix = 2;

    for (;;) {
        const query = { slug };
        if (ignoreId) query._id = { $ne: ignoreId };

        const exists = await Model.findOne(query).select("_id");
        if (!exists) return slug;

        slug = base + "-" + suffix;
        suffix++;
    }
}

module.exports = { createSlug, uniqueSlug };
