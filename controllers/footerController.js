const { getFooterContent, normShippingZones } = require("../utils/footerContent");
const { getSettingsDoc, saveSettings } = require("../utils/siteSettings");
const { normPaymentAccounts, normPaymentIcons } = require("../utils/paymentForms");

function str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function text(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/\r\n/g, "\n")
        .trim();
}

function isActive(value) {
    return value === true || value === "on" || value === "true" || value === "1";
}

function num(value, def, min, max) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = def;
    if (n < min) n = min;
    if (n > max) n = max;
    return Math.round(n * 100) / 100;
}

function rowsOf(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return Object.values(value);
    return [];
}

function normInfoBlocks(value) {
    return rowsOf(value)
        .map(function (r) {
            const kind = str(r.kind);
            return {
                kind: ["image", "video"].indexOf(kind) !== -1 ? kind : "text",
                title: str(r.title),
                text: text(r.text),
                image: str(r.image),
                video: str(r.video),
                link: str(r.link),
                active: isActive(r.active)
            };
        })
        .filter(function (r) {
            return r.title || r.text || r.image || r.video;
        });
}

function normColumns(value) {
    return rowsOf(value)
        .map(function (r) {
            const links = rowsOf(r.links)
                .map(function (l) {
                    return {
                        label: str(l.label),
                        url: str(l.url),
                        active: isActive(l.active)
                    };
                })
                .filter(function (l) { return l.label || l.url; });
            return {
                title: str(r.title),
                links: links,
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.title || r.links.length; });
}

function normMemberships(value) {
    return rowsOf(value)
        .map(function (r) {
            return {
                name: str(r.name),
                image: str(r.image),
                link: str(r.link),
                height: num(r.height, 0, 0, 200),
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.name || r.image; });
}

/* ======================================================
   ADMIN - FOOTER PAGE (GET)
====================================================== */

exports.getFooter = async (req, res) => {
    try {
        const [content, settings] = await Promise.all([
            getFooterContent(),
            getSettingsDoc()
        ]);

        return res.render("admin/footer", {
            pageTitle: "Footer",
            content: content.toObject(),
            settings,
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getFooter error:", error.message);
        return res.redirect("/admin/dashboard");
    }
};

/* ======================================================
   ADMIN - SAVE FOOTER (POST)
====================================================== */

exports.postFooter = async (req, res) => {
    try {
        const body = req.body || {};
        const content = await getFooterContent();

        content.logo = {
            image: str(body["logo.image"]) || "/images/logo.svg",
            link: str(body["logo.link"]),
            height: num(body["logo.height"], 45, 0, 200),
            mobileHeight: num(body["logo.mobileHeight"], 36, 0, 200)
        };
        content.infoBlocks = normInfoBlocks(body.infoBlocks);
        content.columns = normColumns(body.columns);
        content.memberships = normMemberships(body.memberships);
        content.membershipTitle = str(body.membershipTitle) || "Membership";
        if (body.shippingZones !== undefined) {
            content.shippingZones = normShippingZones(body.shippingZones);
        }
        // Payment accounts/icons now live in the separate Payment Methods section.
        if (body.paymentAccounts !== undefined) {
            content.paymentAccounts = normPaymentAccounts(body.paymentAccounts);
        }
        if (body.paymentIcons !== undefined) {
            content.paymentIcons = normPaymentIcons(body.paymentIcons);
        }
        content.copyrightText = text(body.copyrightText);

        await content.save();

        // SEO defaults are managed in SEO & Marketing; only save when posted.
        if (body.metaTitle !== undefined || body.metaDescription !== undefined) {
            const seoUpdate = {};
            if (body.metaTitle !== undefined) seoUpdate.metaTitle = str(body.metaTitle);
            if (body.metaDescription !== undefined) seoUpdate.metaDescription = text(body.metaDescription);
            await saveSettings(seoUpdate);
        }

        return res.redirect("/admin/footer?message=saved");
    } catch (error) {
        console.error("postFooter error:", error.message);
        return res.redirect("/admin/footer?message=error");
    }
};
