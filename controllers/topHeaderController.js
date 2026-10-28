const { getSettingsDoc, saveSettings } = require("../utils/siteSettings");

function str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

/* qs-parsed indexed rows ({0:{...},1:{...}} or array) → array */
function rowsOf(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : Object.values(value);
}

function color(value) {
    const v = str(value);
    return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : "";
}

/* ======================================================
   ADMIN - TOP HEADER PANEL (GET)
====================================================== */

exports.getTopHeader = async (req, res) => {
    try {
        const doc = await getSettingsDoc();
        const tb = doc.topbar || {};

        return res.render("admin/topHeader", {
            pageTitle: "Top Header Panel",
            message: req.query.saved === "1" ? "saved" : null,
            logoUrl: str(tb.logoUrl),
            searchPlaceholder: str(tb.searchPlaceholder),
            notices: (tb.notices || []).filter(function (n) { return str(n.text); }),
            contacts: (tb.contacts || []).filter(function (c) { return str(c.text); }),
            actions: (tb.actions || []).filter(function (a) { return str(a.title); }),
            colors: tb.colors || {}
        });
    } catch (error) {
        console.error("Top header page error:", error);
        return res.status(500).render("errors/500");
    }
};

/* ======================================================
   ADMIN - TOP HEADER PANEL (POST)
====================================================== */

exports.postTopHeader = async (req, res) => {
    try {
        const body = req.body;

        const notices = rowsOf(body.notices)
            .map(function (r) {
                return {
                    text: str(r.text),
                    link: str(r.link),
                    textColor: color(r.textColor),
                    bgColor: color(r.bgColor)
                };
            })
            .filter(function (r) { return r.text; });

        const contacts = rowsOf(body.contacts)
            .map(function (r) {
                return {
                    icon: str(r.icon) || "fa-solid fa-phone",
                    label: str(r.label),
                    text: str(r.text),
                    link: str(r.link),
                    textColor: color(r.textColor),
                    bgColor: color(r.bgColor)
                };
            })
            .filter(function (r) { return r.text; });

        const actions = rowsOf(body.actions)
            .map(function (r) {
                return {
                    icon: str(r.icon) || "fa-solid fa-star",
                    title: str(r.title),
                    link: str(r.link),
                    badge: ["none", "wishlist", "cart", "compare"].indexOf(str(r.badge)) !== -1 ? str(r.badge) : "none",
                    highlight: r.highlight === "on" || r.highlight === "true",
                    textColor: color(r.textColor),
                    bgColor: color(r.bgColor),
                    showDesktop: r.showDesktop === "on" || r.showDesktop === "true",
                    showMobile: r.showMobile === "on" || r.showMobile === "true"
                };
            })
            .filter(function (r) { return r.title; });

        const colors = {
            topbarBg: color(body["colors.topbarBg"]),
            topbarText: color(body["colors.topbarText"]),
            headerBg: color(body["colors.headerBg"])
        };

        await saveSettings({
            topbar: {
                logoUrl: str(body.logoUrl),
                searchPlaceholder: str(body.searchPlaceholder),
                notices, contacts, actions, colors
            }
        });

        return res.redirect("/admin/top-header?saved=1");
    } catch (error) {
        console.error("Top header save error:", error);
        return res.status(500).send("Unable to save the top header settings.");
    }
};
