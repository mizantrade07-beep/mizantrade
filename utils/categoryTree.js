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

/* একটি ক্যাটাগরি (slug) + তার সব বংশধরের FULL PATH (main/sub/child name)
   রিটার্ন করে। শুধু name-এর বদলে path ব্যবহার করলে একই brand-name
   (যেমন "Unika") একাধিক শাখায় থাকলেও ভুল শাখায় প্রোডাক্ট leak করে না। */
function collectFamilyPaths(flat, rootSlug) {
    const list = flat || [];
    const bySlug = {};
    const byParent = {};

    list.forEach(function (cat) {
        bySlug[cat.slug] = cat;
        const key = cat.parent || "";
        if (!byParent[key]) byParent[key] = [];
        byParent[key].push(cat);
    });

    function levelAndPath(slug) {
        const chain = [];
        const guard = new Set();
        let cur = slug;
        while (cur && !guard.has(cur)) {
            guard.add(cur);
            const n = bySlug[cur];
            if (!n) break;
            chain.unshift(n);
            cur = n.parent || null;
        }
        const p = { main: "", sub: "", child: "" };
        chain.forEach(function (n, i) {
            if (i === 0) p.main = n.name;
            else if (i === 1) p.sub = n.name;
            else if (i === 2) p.child = n.name;
        });
        return { path: p, level: chain.length || 1 };
    }

    const results = [];
    const seen = new Set();

    function walk(slug, level, path) {
        const node = bySlug[slug];
        if (!node) return;

        const p = { main: path.main, sub: path.sub, child: path.child };
        if (level === 1) { p.main = node.name; p.sub = ""; p.child = ""; }
        else if (level === 2) { p.sub = node.name; p.child = ""; }
        else if (level === 3) { p.child = node.name; }

        const key = level + "|" + p.main + "|" + p.sub + "|" + p.child;
        if (!seen.has(key)) {
            seen.add(key);
            results.push({
                main: p.main,
                sub: p.sub,
                child: p.child,
                level: level
            });
        }

        if (level < 3) {
            (byParent[slug] || []).forEach(function (kid) {
                walk(kid.slug, level + 1, p);
            });
        }
    }

    const root = levelAndPath(rootSlug);
    walk(rootSlug, root.level, root.path);
    return results;
}

/* root → current পর্যন্ত ক্যাটাগরির চেইন (parent আগে, current শেষে) */
function categoryTrail(flat, slug) {
    const bySlug = {};
    (flat || []).forEach(function (cat) {
        bySlug[cat.slug] = cat;
    });

    const chain = [];
    const guard = new Set();
    let current = slug ? bySlug[slug] : null;

    while (current && !guard.has(current.slug)) {
        guard.add(current.slug);
        chain.unshift(current);
        current = current.parent ? bySlug[current.parent] : null;
    }

    return chain;
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
    collectFamilyPaths: collectFamilyPaths,
    categoryTrail: categoryTrail,
    collectDescendantSlugs: collectDescendantSlugs
};
