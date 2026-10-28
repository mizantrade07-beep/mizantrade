/* ======================================================
   OFFER DISPLAY HELPERS
====================================================== */

const TYPE_ICONS = [
    { match: /product|item|stock/i, icon: "fa-box" },
    { match: /package|combo|bundle/i, icon: "fa-gift" },
    { match: /tour|trip|travel|holiday/i, icon: "fa-plane" },
    { match: /service|support/i, icon: "fa-headset" },
    { match: /discount|sale|deal/i, icon: "fa-percent" }
];

function offerTypeIcon(type) {
    const raw = String(type || "").trim();
    for (let i = 0; i < TYPE_ICONS.length; i++) {
        if (TYPE_ICONS[i].match.test(raw)) return TYPE_ICONS[i].icon;
    }
    return "fa-tag";
}

function offerPriceLabel(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";

    const cleaned = raw
        .replace(/[৳$€]/g, "")
        .replace(/,/g, "")
        .trim();

    if (/^\d+(\.\d+)?$/.test(cleaned)) {
        return (
            "৳ " +
            Number(cleaned).toLocaleString("en-IN", {
                maximumFractionDigits: 2
            })
        );
    }

    return raw;
}

function offerScopeSlugs(offer) {
    const out = [];
    ["categories", "subCategories", "childCategories"].forEach(function (key) {
        (offer && offer[key] ? offer[key] : []).forEach(function (slug) {
            if (slug) out.push(slug);
        });
    });
    return out;
}

function sortOfferTypes(offers) {
    const seen = new Set();
    const types = [];
    offers.forEach(function (offer) {
        const type = String(offer.type || "").trim() || "Other";
        if (!seen.has(type)) {
            seen.add(type);
            types.push(type);
        }
    });
    return types;
}

module.exports = {
    offerTypeIcon: offerTypeIcon,
    offerPriceLabel: offerPriceLabel,
    offerScopeSlugs: offerScopeSlugs,
    sortOfferTypes: sortOfferTypes
};
