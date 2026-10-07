/* ======================================================
   CATEGORY TREE HELPER
   ৩ লেভেলের ক্যাটাগরি ট্রি: Main (level 1) → Sub (level 2) → Child (level 3)
   Category model-এ parent = প্যারেন্টের slug ("" মানে Main)।
====================================================== */

function sortNodes(nodes) {
    return nodes.slice().sort(function (a, b) {
        if ((a.order || 0) !== (b.order || 0)) {
            return (a.order || 0) - (b.order || 0);
        }
        return String(a.name).localeCompare(String(b.name));
    });
}

/* flat (lean) ক্যাটাগরি লিস্ট থেকে nested ট্রি বানায় */
function buildTree(flat) {
    const list = flat || [];
    const slugs = new Set(list.map((c) => c.slug));

    const byParent = {};
    list.forEach(function (cat) {
        const key = cat.parent || "";
        if (!byParent[key]) byParent[key] = [];
        byParent[key].push(cat);
    });

    function build(node, level, parentPath) {
        const path = Object.assign({}, parentPath);
        if (level === 1) { path.main = node.name; path.sub = ""; path.child = ""; }
        if (level === 2) { path.sub = node.name; path.child = ""; }
        if (level === 3) { path.child = node.name; }

        const kids = sortNodes(byParent[node.slug] || []).map(function (kid) {
            return build(kid, level + 1, path);
        });

        return Object.assign({}, node, {
            level: level,
            path: path,
            children: kids
        });
    }

    const tree = sortNodes(byParent[""] || []).map(function (root) {
        return build(root, 1, { main: "", sub: "", child: "" });
    });

    // যেসব ক্যাটাগরির parent slug ডাটাবেসে নেই
    const orphans = list.filter(function (cat) {
        return cat.parent && !slugs.has(cat.parent);
    });

    return { tree: tree, orphans: orphans, byParent: byParent };
}

/* একটি ক্যাটাগরি (slug) + তার সব বংশধরের name ও slug একসাথে রিটার্ন করে */
function collectFamilyNames(flat, rootSlug) {
    const list = flat || [];
    const byParent = {};
    list.forEach(function (cat) {
        const key = cat.parent || "";
        if (!byParent[key]) byParent[key] = [];
        byParent[key].push(cat);
    });

    const names = [];
    const seen = new Set();

    function push(value) {
        if (value && !seen.has(value)) {
            seen.add(value);
            names.push(value);
        }
    }

    function walk(slug) {
        const node = list.find(function (c) { return c.slug === slug; });
        if (node) {
            push(node.slug);
            push(node.name);
        } else {
            push(slug);
        }
        (byParent[slug] || []).forEach(function (kid) {
            walk(kid.slug);
        });
    }

    walk(rootSlug);
    return names;
}

/* এডিটের সময় নিজের + নিজের বংশধরের slug লিস্ট (cycle এড়াতে) */
function collectDescendantSlugs(flat, rootSlug) {
    const list = flat || [];
    const byParent = {};
    list.forEach(function (cat) {
        const key = cat.parent || "";
        if (!byParent[key]) byParent[key] = [];
        byParent[key].push(cat);
    });

    const slugs = [rootSlug];
    (function walk(slug) {
        (byParent[slug] || []).forEach(function (kid) {
            slugs.push(kid.slug);
            walk(kid.slug);
        });
    })(rootSlug);

    return slugs;
}

module.exports = {
    buildTree: buildTree,
    collectFamilyNames: collectFamilyNames,
    collectDescendantSlugs: collectDescendantSlugs
};
