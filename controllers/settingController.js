const { getSettingsDoc, saveSettings } = require("../utils/siteSettings");
const { getFooterContent, normShippingZones } = require("../utils/footerContent");

/* Number helper: empty string -> undefined so schema default is not clobbered
   with NaN; otherwise coerce to Number. */
function num(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return undefined;
    }
    const n = Number(value);
    return isNaN(n) ? undefined : n;
}

function str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function bool(value) {
    return value === true || value === "on" || value === "true" || value === "1";
}

const SOCIAL_PLATFORMS = [
    "facebook", "youtube", "instagram", "tiktok",
    "linkedin", "whatsapp", "x", "snapchat",
    "discord", "threads", "pinterest", "reddit", "telegram"
];

const GATEWAY_KEYS = ["bkash", "nagad", "rocket", "card", "bank", "cod"];

/* qs দিয়ে পার্স হওয়া indexed rows ({0:{...},1:{...}} বা array) → array */
function rowsOf(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : Object.values(value);
}

function normSocials(value) {
    return rowsOf(value)
        .map(function (r) {
            return {
                platform: SOCIAL_PLATFORMS.indexOf(str(r.platform)) !== -1 ? str(r.platform) : "facebook",
                url: str(r.url),
                label: str(r.label)
            };
        })
        .filter(function (r) { return r.url; });
}

function normLanguages(value) {
    return rowsOf(value)
        .map(function (r) {
            return {
                code: str(r.code).toLowerCase().slice(0, 10),
                name: str(r.name).slice(0, 60),
                active: bool(r.active)
            };
        })
        .filter(function (r) { return r.code && r.name; });
}

/* Blank secret fields keep the stored value instead of wiping it. */
function gatewayData(existing, posted) {
    const prev = existing || {};
    const saved = {};

    GATEWAY_KEYS.forEach(function (key) {
        const src = posted[key] || {};
        const old = prev[key] || {};

        saved[key] = {
            enabled: key === "cod"
                ? (src.enabled !== undefined ? bool(src.enabled) : old.enabled !== false)
                : bool(src.enabled),
            mode: str(src.mode) === "live" ? "live" : "sandbox",
            apiKey: str(src.apiKey) || old.apiKey || "",
            apiSecret: str(src.apiSecret) || old.apiSecret || "",
            username: str(src.username) || old.username || "",
            password: str(src.password) || old.password || "",
            merchantId: str(src.merchantId) || old.merchantId || ""
        };
    });

    return saved;
}

/* ======================================================
   ADMIN - SETTINGS PAGE (GET)
====================================================== */

exports.getSettingsPage = async (req, res) => {
    try {
        const [settings, content] = await Promise.all([
            getSettingsDoc(),
            getFooterContent()
        ]);

        res.render("admin/settings", {
            settings,
            shippingZones: content.shippingZones || [],
            message: req.query.message || null,
            pageTitle: "Website Settings"
        });
    } catch (error) {
        console.error("getSettingsPage error:", error.message);
        res.redirect("/admin/dashboard");
    }
};

/* ======================================================
   ADMIN - UPDATE SETTINGS (POST)
====================================================== */

exports.postUpdateSettings = async (req, res) => {
    try {
        const body = req.body || {};
        const current = await getSettingsDoc();

        const data = {
            siteName: str(body.siteName),
            hotline: str(body.hotline),
            email: str(body.email),
            address: str(body.address),
            faviconUrl: str(body.faviconUrl),

            general: {
                tagline: str(body["general.tagline"]),
                logoUrl: str(body["general.logoUrl"]),
                hotline: str(body["general.hotline"]),
                supportPhone: str(body["general.supportPhone"]),
                operatingHours: str(body["general.operatingHours"]),
                timezone: str(body["general.timezone"]) || "Asia/Dhaka",
                dateFormat: str(body["general.dateFormat"]) || "DD/MM/YYYY",
                mapUrl: str(body["general.mapUrl"])
            },

            localization: {
                country: str(body["localization.country"]) || "Bangladesh",
                currency: str(body["localization.currency"]) || "BDT",
                currencySymbol: str(body["localization.currencySymbol"]) || "৳",
                defaultLanguage: str(body["localization.defaultLanguage"]) || "en",
                languages: body.languages !== undefined
                    ? normLanguages(body.languages)
                    : ((current.localization && current.localization.languages) || [])
            },

            paymentGateways: gatewayData(current.paymentGateways, {
                bkash: {
                    enabled: body["gateways.bkash.enabled"],
                    mode: body["gateways.bkash.mode"],
                    apiKey: body["gateways.bkash.apiKey"],
                    apiSecret: body["gateways.bkash.apiSecret"],
                    username: body["gateways.bkash.username"],
                    password: body["gateways.bkash.password"],
                    merchantId: body["gateways.bkash.merchantId"]
                },
                nagad: {
                    enabled: body["gateways.nagad.enabled"],
                    mode: body["gateways.nagad.mode"],
                    apiKey: body["gateways.nagad.apiKey"],
                    apiSecret: body["gateways.nagad.apiSecret"],
                    username: body["gateways.nagad.username"],
                    password: body["gateways.nagad.password"],
                    merchantId: body["gateways.nagad.merchantId"]
                },
                rocket: {
                    enabled: body["gateways.rocket.enabled"],
                    mode: body["gateways.rocket.mode"],
                    apiKey: body["gateways.rocket.apiKey"],
                    apiSecret: body["gateways.rocket.apiSecret"],
                    username: body["gateways.rocket.username"],
                    password: body["gateways.rocket.password"],
                    merchantId: body["gateways.rocket.merchantId"]
                },
                card: {
                    enabled: body["gateways.card.enabled"],
                    mode: body["gateways.card.mode"],
                    apiKey: body["gateways.card.apiKey"],
                    apiSecret: body["gateways.card.apiSecret"],
                    username: body["gateways.card.username"],
                    password: body["gateways.card.password"],
                    merchantId: body["gateways.card.merchantId"]
                },
                bank: {
                    enabled: body["gateways.bank.enabled"],
                    mode: body["gateways.bank.mode"],
                    apiKey: body["gateways.bank.apiKey"],
                    apiSecret: body["gateways.bank.apiSecret"],
                    username: body["gateways.bank.username"],
                    password: body["gateways.bank.password"],
                    merchantId: body["gateways.bank.merchantId"]
                },
                cod: { enabled: body["gateways.cod.enabled"] }
            }),

            shipping: {
                insideDhaka: num(body["shipping.insideDhaka"]),
                outsideDhaka: num(body["shipping.outsideDhaka"])
            },

            courier: {
                provider: str(body["courier.provider"]),
                apiKey: str(body["courier.apiKey"]) || (current.courier && current.courier.apiKey) || "",
                apiSecret: str(body["courier.apiSecret"]) || (current.courier && current.courier.apiSecret) || "",
                sandbox: bool(body["courier.sandbox"]),
                freeShippingThreshold: num(body["courier.freeShippingThreshold"]) || 0,
                deliveryTime: str(body["courier.deliveryTime"])
            },

            tax: {
                enabled: bool(body["tax.enabled"]),
                label: str(body["tax.label"]) || "VAT",
                percent: num(body["tax.percent"]) || 0,
                inclusive: bool(body["tax.inclusive"]),
                applyToShipping: bool(body["tax.applyToShipping"])
            },

            userSecurity: {
                passwordMinLength: Math.min(
                    32,
                    Math.max(4, num(body["userSecurity.passwordMinLength"]) || 6)
                ),
                requireOtpLogin: bool(body["userSecurity.requireOtpLogin"]),
                allowSocialLogin: bool(body["userSecurity.allowSocialLogin"]),
                sessionTimeoutMinutes: Math.max(0, num(body["userSecurity.sessionTimeoutMinutes"]) || 0),
                csrfEnabled: !!(
                    current.userSecurity && current.userSecurity.csrfEnabled
                )
            },

            social: {
                facebook: str(body["social.facebook"]),
                instagram: str(body["social.instagram"]),
                youtube: str(body["social.youtube"]),
                whatsapp: str(body["social.whatsapp"]),
                linkedin: str(body["social.linkedin"])
            },

            socials: normSocials(body.socials)
        };

        /* SEO defaults are managed in SEO & Marketing; only touch them when posted. */
        if (body.metaTitle !== undefined) data.metaTitle = str(body.metaTitle);
        if (body.metaDescription !== undefined) data.metaDescription = str(body.metaDescription);
        if (body.metaKeywords !== undefined) data.metaKeywords = str(body.metaKeywords);
        if (body.ogImage !== undefined) data.ogImage = str(body.ogImage);

        /* Object.assign with nested objects would replace them wholesale;
           drop undefined nested numbers so existing values survive. */
        ["shipping"].forEach(function (group) {
            Object.keys(data[group]).forEach(function (k) {
                if (data[group][k] === undefined) delete data[group][k];
            });
        });

        await saveSettings(data);

        /* Shipping zones live in FooterContent and are shared with checkout. */
        if (body.shippingZones !== undefined) {
            const content = await getFooterContent();
            content.shippingZones = normShippingZones(body.shippingZones);
            await content.save();
        }

        res.redirect("/admin/settings?message=saved");
    } catch (error) {
        console.error("postUpdateSettings error:", error.message);
        res.redirect("/admin/settings?message=error");
    }
};
