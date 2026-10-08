const Setting = require("../models/Setting");
const siteConfig = require("../config/site");

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

/* Convert a Setting mongoose doc into a plain mergeable object. */
function toPlain(doc) {
    return {
        siteName: doc.siteName,
        hotline: doc.hotline,
        email: doc.email,
        address: doc.address,
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
        footerText: doc.footerText,
        metaTitle: doc.metaTitle,
        metaDescription: doc.metaDescription
    };
}

/* Fetch the singleton (creating it from config defaults if missing). */
async function getSettingsDoc() {
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
