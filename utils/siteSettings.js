const Setting = require("../models/Setting");
const siteConfig = require("../config/site");

const DEFAULT_NOTICE =
    "⚠️ Official Notice: Mizan Trade is the sole authorized distributor of KingSpec, AITC Kingsman Gaming, Xentrha, Unika, and PowerSync products. To avoid counterfeit products, please verify the \"AUTHORIZED PRODUCT – Powered by MIZAN TRADE\" sticker at the time of purchase.";

/* Deep-merge plain objects (source wins). Arrays/primitives overwrite. */
function deepAssign(target, source) {
    Object.keys(source).forEach(function (key) {
        const val = source[key];
        if (
            val &&
            typeof val === "object" &&
            !Array.isArray(val) &&
            target[key] &&
            typeof target[key] === "object"
        ) {
            deepAssign(target[key], val);
        } else if (val !== undefined) {
            target[key] = val;
        }
    });
    return target;
}

function plainGateway(gw) {
    const g = gw || {};
    return {
        enabled: g.enabled === true,
        mode: g.mode === "live" ? "live" : "sandbox",
        apiKey: g.apiKey || "",
        apiSecret: g.apiSecret || "",
        username: g.username || "",
        password: g.password || "",
        merchantId: g.merchantId || ""
    };
}

/* Convert a Setting mongoose doc into a plain mergeable object. */
function toPlain(doc) {
    const general = doc.general || {};
    const localization = doc.localization || {};
    const gateways = doc.paymentGateways || {};
    const courier = doc.courier || {};
    const tax = doc.tax || {};
    const security = doc.userSecurity || {};
    const rewards = doc.rewards || {};
    const marketing = doc.marketing || {};
    const productBanner = doc.productBanner || {};

    return {
        siteName: doc.siteName,
        hotline: doc.hotline,
        email: doc.email,
        address: doc.address,

        general: {
            tagline: general.tagline || "",
            logoUrl: general.logoUrl || "",
            hotline: general.hotline || doc.hotline || "",
            supportPhone: general.supportPhone || "",
            operatingHours: general.operatingHours || "",
            timezone: general.timezone || "Asia/Dhaka",
            dateFormat: general.dateFormat || "DD/MM/YYYY",
            mapUrl: general.mapUrl || ""
        },

        localization: {
            country: localization.country || "Bangladesh",
            currency: localization.currency || "BDT",
            currencySymbol: localization.currencySymbol || "৳",
            defaultLanguage: localization.defaultLanguage || "en",
            languages: (localization.languages || []).map(function (l) {
                return { code: l.code || "", name: l.name || "", active: l.active !== false };
            })
        },

        paymentGateways: {
            bkash: plainGateway(gateways.bkash),
            nagad: plainGateway(gateways.nagad),
            rocket: plainGateway(gateways.rocket),
            card: plainGateway(gateways.card),
            bank: plainGateway(gateways.bank),
            cod: { enabled: !gateways.cod || gateways.cod.enabled !== false }
        },

        courier: {
            provider: courier.provider || "",
            apiKey: courier.apiKey || "",
            apiSecret: courier.apiSecret || "",
            sandbox: courier.sandbox !== false,
            freeShippingThreshold: Number(courier.freeShippingThreshold) || 0,
            deliveryTime: courier.deliveryTime || ""
        },

        tax: {
            enabled: tax.enabled === true,
            label: tax.label || "VAT",
            percent: Number(tax.percent) || 0,
            inclusive: tax.inclusive === true,
            applyToShipping: tax.applyToShipping === true
        },

        userSecurity: {
            passwordMinLength: Number(security.passwordMinLength) || 6,
            requireOtpLogin: security.requireOtpLogin === true,
            allowSocialLogin: security.allowSocialLogin !== false,
            sessionTimeoutMinutes: Number(security.sessionTimeoutMinutes) || 0,
            csrfEnabled: security.csrfEnabled === true
        },

        rewards: {
            enabled: rewards.enabled !== false,
            pointValue: rewards.pointValue === undefined ? 1 : Number(rewards.pointValue) || 0,
            minRedeem: rewards.minRedeem === undefined ? 50 : Number(rewards.minRedeem) || 0,
            label: rewards.label || "Reward Points"
        },

        marketing: {
            ga4Id: marketing.ga4Id || "",
            gtmId: marketing.gtmId || "",
            fbPixelId: marketing.fbPixelId || "",
            googleVerification: marketing.googleVerification || "",
            bingVerification: marketing.bingVerification || "",
            fbVerification: marketing.fbVerification || "",
            customHead: marketing.customHead || "",
            customBody: marketing.customBody || "",
            organicVisits: Number(marketing.organicVisits) || 0,
            googleRanking: Number(marketing.googleRanking) || 0,
            searchVisibility: Number(marketing.searchVisibility) || 0,
            brandCredibility: Number(marketing.brandCredibility) || 0,
            longTermGrowth: Number(marketing.longTermGrowth) || 0,
            kpiNote: marketing.kpiNote || "",
            kpiUpdatedAt: marketing.kpiUpdatedAt || null
        },

        productBanner: {
            enabled: productBanner.enabled === true,
            image: productBanner.image || "",
            link: productBanner.link || ""
        },

        seoPages: (doc.seoPages || []).map(function (p) {
            return {
                path: p.path || "",
                title: p.title || "",
                description: p.description || "",
                keywords: p.keywords || "",
                robots: p.robots === "noindex" ? "noindex" : "index",
                active: p.active !== false
            };
        }),
        shipping: {
            insideDhaka: doc.shipping.insideDhaka,
            outsideDhaka: doc.shipping.outsideDhaka
        },
        bkash: {
            number: doc.bkash.number,
            type: doc.bkash.type,
            chargePercent: doc.bkash.chargePercent
        },
        bank: {
            bankName: doc.bank.bankName,
            branch: doc.bank.branch,
            accountName: doc.bank.accountName,
            accountNumber: doc.bank.accountNumber,
            routingNumber: doc.bank.routingNumber
        },
        social: {
            facebook: doc.social.facebook,
            instagram: doc.social.instagram,
            youtube: doc.social.youtube,
            whatsapp: doc.social.whatsapp,
            linkedin: doc.social.linkedin
        },
        socials: (doc.socials || []).map(function (s) {
            return { platform: s.platform, url: s.url, label: s.label };
        }),
        topbar: {
            logoUrl: (doc.topbar && doc.topbar.logoUrl) || "",
            searchPlaceholder: (doc.topbar && doc.topbar.searchPlaceholder) || "",
            notices: ((doc.topbar && doc.topbar.notices) || []).map(function (n) {
                if (typeof n === "string") {
                    return { text: n, link: "", textColor: "", bgColor: "" };
                }
                return {
                    text: n.text || "",
                    link: n.link || "",
                    textColor: n.textColor || "",
                    bgColor: n.bgColor || ""
                };
            }),
            contacts: ((doc.topbar && doc.topbar.contacts) || []).map(function (c) {
                return {
                    icon: c.icon, label: c.label, text: c.text, link: c.link,
                    textColor: c.textColor || "", bgColor: c.bgColor || ""
                };
            }),
            actions: ((doc.topbar && doc.topbar.actions) || []).map(function (a) {
                return {
                    icon: a.icon, title: a.title, link: a.link,
                    badge: a.badge || "none",
                    highlight: a.highlight === true,
                    textColor: a.textColor || "", bgColor: a.bgColor || "",
                    showDesktop: a.showDesktop !== false,
                    showMobile: a.showMobile !== false
                };
            }),
            colors: {
                topbarBg: (doc.topbar && doc.topbar.colors && doc.topbar.colors.topbarBg) || "",
                topbarText: (doc.topbar && doc.topbar.colors && doc.topbar.colors.topbarText) || "",
                headerBg: (doc.topbar && doc.topbar.colors && doc.topbar.colors.headerBg) || ""
            }
        },
        footerBlocks: (doc.footerBlocks || []).map(function (b) {
            return {
                title: b.title,
                items: (b.items || []).map(function (it) {
                    return { type: it.type, text: it.text, url: it.url, image: it.image };
                })
            };
        }),
        footerText: doc.footerText,
        metaTitle: doc.metaTitle,
        metaDescription: doc.metaDescription,
        metaKeywords: doc.metaKeywords,
        ogImage: doc.ogImage,
        faviconUrl: doc.faviconUrl
    };
}

/* One-time raw-driver migration: legacy plain-string notices → objects.
   Runs before any mongoose read so the new [subdoc] schema never sees strings. */
async function migrateLegacyTopbar() {
    try {
        const raw = await Setting.collection.findOne({}, { sort: { createdAt: 1 } });
        if (!raw || !raw.topbar || !Array.isArray(raw.topbar.notices)) return;
        if (!raw.topbar.notices.length || typeof raw.topbar.notices[0] !== "string") return;

        await Setting.collection.updateOne(
            { _id: raw._id },
            {
                $set: {
                    "topbar.notices": raw.topbar.notices.map(function (n) {
                        return typeof n === "string"
                            ? { text: n, link: "", textColor: "", bgColor: "" }
                            : n;
                    })
                }
            }
        );
    } catch (err) {
        console.error("migrateLegacyTopbar error:", err.message);
    }
}

/* Fetch the singleton (creating it from config defaults if missing).
   পুরনো ডাটা থেকে socials/topbar একবার seed করা হয় যাতে অ্যাডমিন
   ম্যানেজারে ডিফল্ট এন্ট্রিগুলো দেখা যায়। */
async function getSettingsDoc() {
    await migrateLegacyTopbar();

    let doc = await Setting.findOne({}).sort({ createdAt: 1 });
    if (!doc) {
        doc = await Setting.create({
            siteName: siteConfig.siteName,
            hotline: siteConfig.hotline,
            email: siteConfig.email,
            shipping: siteConfig.shipping,
            bkash: siteConfig.bkash,
            bank: siteConfig.bank
        });
    }

    let seeded = false;

    if (!doc.socials || doc.socials.length === 0) {
        const legacy = doc.social || {};
        doc.socials = [
            { platform: "facebook", url: legacy.facebook || "", label: "" },
            { platform: "youtube", url: legacy.youtube || "", label: "" },
            { platform: "instagram", url: legacy.instagram || "", label: "" },
            { platform: "whatsapp", url: legacy.whatsapp || "", label: "" },
            { platform: "linkedin", url: legacy.linkedin || "", label: "" }
        ].filter(function (s) { return s.url; });
        seeded = true;
    }

    if (!doc.topbar || ((!doc.topbar.notices || !doc.topbar.notices.length) && (!doc.topbar.contacts || !doc.topbar.contacts.length))) {
        doc.topbar = {
            notices: [DEFAULT_NOTICE],
            contacts: [
                {
                    icon: "fa-regular fa-envelope",
                    label: "",
                    text: siteConfig.email || "",
                    link: siteConfig.email ? "mailto:" + siteConfig.email : ""
                },
                {
                    icon: "fa-solid fa-phone",
                    label: "Hotline",
                    text: siteConfig.hotline || "",
                    link: siteConfig.hotline ? "tel:" + siteConfig.hotline : ""
                }
            ]
        };
        seeded = true;
    }

    /* Seed default header actions once. */
    if (!doc.topbar.actions || !doc.topbar.actions.length) {
        doc.topbar.actions = [
            { icon: "fa-solid fa-fire", title: "Offer", link: "/offers", badge: "none", showDesktop: true, showMobile: true },
            { icon: "fa-solid fa-handshake", title: "Become a Partner", link: "/become-a-partner", badge: "none", showDesktop: true, showMobile: true },
            { icon: "fa-regular fa-heart", title: "Wishlist", link: "/wishlist", badge: "wishlist", showDesktop: true, showMobile: true },
            { icon: "fa-solid fa-cart-shopping", title: "Cart", link: "/cart", badge: "cart", showDesktop: true, showMobile: true }
        ];
        seeded = true;
    }

    if (seeded) {
        await doc.save();
    }

    return doc;
}

/* Load settings from DB and apply them onto the cached config/site object
   so every existing require("../config/site") consumer sees the new values. */
async function loadSettings() {
    try {
        const doc = await getSettingsDoc();
        deepAssign(siteConfig, toPlain(doc));
    } catch (err) {
        console.error("loadSettings error:", err.message);
    }
    return siteConfig;
}

/* Persist edits, then re-apply to the cached config object. */
async function saveSettings(data) {
    const doc = await getSettingsDoc();
    Object.assign(doc, data);
    await doc.save();
    deepAssign(siteConfig, toPlain(doc));
    return doc;
}

module.exports = {
    loadSettings,
    saveSettings,
    getSettingsDoc,
    siteConfig
};
