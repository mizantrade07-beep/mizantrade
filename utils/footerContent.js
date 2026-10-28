const FooterContent = require("../models/FooterContent");
const siteConfig = require("../config/site");

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function defaultInfoBlocks() {
    const address = String(siteConfig.address || "").trim() ||
        "Shop No 301-303, Level 3, 69-71\nNew Elephant Road, Dhaka.";

    return [
        { kind: "text", title: "Address", text: address, image: "", link: "", active: true },
        { kind: "text", title: "Showroom address", text: address, image: "", link: "", active: true }
    ];
}

function defaultColumns() {
    return [
        {
            title: "About Company",
            active: true,
            links: [
                { label: "About Us", url: "/about" },
                { label: "Blog", url: "/blog" },
                { label: "Contact Us", url: "/contact" },
                { label: "Privacy Policy", url: "/privacy-policy" },
                { label: "Our Brand", url: "/our-brand" },
                { label: "FAQ", url: "/faq" }
            ]
        },
        {
            title: "Customer Help",
            active: true,
            links: [
                { label: "Warranty", url: "/warranty" },
                { label: "Repair and Services", url: "/services" },
                { label: "Refund And Return Policy", url: "/refund-policy" },
                { label: "Terms and Conditions", url: "/terms" },
                { label: "Cookie Policy", url: "/cookie-policy" },
                { label: "Order Tracking", url: "/order-tracking" }
            ]
        },
        {
            title: "Customer Service",
            active: true,
            links: [
                { label: "Become a Partner", url: "/become-a-partner" },
                { label: "Login & Register", url: "/login" },
                { label: "My Account", url: "/account" },
                { label: "Order Procedure", url: "/order-procedure" },
                { label: "Delivery Method", url: "/delivery-method" },
                { label: "Payment Method", url: "/payment-method" }
            ]
        }
    ];
}

function defaultShippingZones() {
    return [
        {
            name: "Inside Dhaka",
            area: "Dhaka",
            thana: "",
            postalCodes: "",
            charge: Number(siteConfig.shipping.insideDhaka) || 0,
            active: true
        },
        {
            name: "Outside Dhaka",
            area: "Outside Dhaka",
            thana: "",
            postalCodes: "",
            charge: Number(siteConfig.shipping.outsideDhaka) || 0,
            active: true
        }
    ];
}

function defaultPaymentAccounts() {
    return [
        {
            type: "bkash",
            label: siteConfig.bkash.type || "Personal",
            number: siteConfig.bkash.number || "",
            accountType: siteConfig.bkash.type || "Personal",
            chargePercent: Number(siteConfig.bkash.chargePercent) || 0,
            bankName: "",
            branch: "",
            accountName: "",
            accountNumber: "",
            routingNumber: "",
            qrImage: "",
            instructions: "",
            active: true
        },
        {
            type: "bank",
            label: siteConfig.bank.bankName || "Bank Transfer",
            number: "",
            accountType: "",
            chargePercent: 0,
            bankName: siteConfig.bank.bankName || "",
            branch: siteConfig.bank.branch || "",
            accountName: siteConfig.bank.accountName || "",
            accountNumber: siteConfig.bank.accountNumber || "",
            routingNumber: siteConfig.bank.routingNumber || "",
            qrImage: "",
            instructions: "",
            active: true
        }
    ];
}

function buildDefaults() {
    return {
        logo: {
            image: "/images/logo.svg",
            link: "/",
            height: 45,
            mobileHeight: 36
        },
        infoBlocks: defaultInfoBlocks(),
        columns: defaultColumns(),
        memberships: [
            { name: "e-CAB", image: "", link: "", height: 0, active: true },
            { name: "BASIS", image: "", link: "", height: 0, active: true },
            { name: "BCC", image: "", link: "", height: 0, active: true }
        ],
        membershipTitle: "Membership",
        shippingZones: defaultShippingZones(),
        paymentAccounts: defaultPaymentAccounts(),
        paymentIcons: [
            { name: "VISA", image: "", active: true },
            { name: "MasterCard", image: "", active: true },
            { name: "bKash", image: "", active: true },
            { name: "Nagad", image: "", active: true },
            { name: "Rocket", image: "", active: true }
        ],
        copyrightText: String(siteConfig.footerText || "").trim() ||
            "© {year} MizanTrade | All Rights Reserved."
    };
}

async function getFooterContent() {
    let doc = await FooterContent.findOne({});
    if (!doc) {
        doc = await FooterContent.create(clone(buildDefaults()));
    }
    return doc;
}

/* Normalises checkout shipping zones posted from Settings or Footer. */
function normShippingZones(value) {
    if (!value) return [];
    const rows = Array.isArray(value) ? value : Object.values(value);

    return rows
        .map(function (r) {
            const n = Number(r.charge);
            return {
                name: String(r.name || "").trim(),
                area: String(r.area || "").trim(),
                thana: String(r.thana || "").trim(),
                postalCodes: String(r.postalCodes || "").trim(),
                charge: Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0,
                active: r.active === true || r.active === "on" || r.active === "true" || r.active === "1"
            };
        })
        .filter(function (r) { return r.name || r.area; });
}

/* ভিউতে পাঠানোর মতো ফিল্টার করা মান */
function effectiveFooter(doc) {
    const d = doc || {};
    const logo = d.logo || {};
    const year = String(new Date().getFullYear());

    const columns = (d.columns || [])
        .filter(function (c) { return c.active !== false; })
        .map(function (c) {
            return {
                title: c.title || "",
                links: (c.links || []).filter(function (l) {
                    return l.active !== false && (l.label || l.url);
                })
            };
        })
        .filter(function (c) { return c.title || c.links.length; });

    const copyrightTemplate = String(d.copyrightText || "").trim() ||
        "© {year} MizanTrade | All Rights Reserved.";

    return {
        logo: {
            image: logo.image || "/images/logo.svg",
            link: logo.link || "",
            height: Number(logo.height) || 45,
            mobileHeight: Number(logo.mobileHeight) || 36
        },
        infoBlocks: (d.infoBlocks || []).filter(function (b) {
            return b.active !== false && (b.title || b.text || b.image || b.video);
        }),
        columns: columns,
        memberships: (d.memberships || []).filter(function (m) {
            return m.active !== false && (m.name || m.image);
        }),
        membershipTitle: d.membershipTitle || "Membership",
        shippingZones: (d.shippingZones || []).filter(function (z) {
            return z.active !== false && (z.name || z.area);
        }),
        paymentAccounts: (d.paymentAccounts || []).filter(function (a) {
            return a.active !== false && (a.type === "bank"
                ? (a.bankName || a.accountNumber)
                : (a.number || a.qrImage));
        }),
        paymentIcons: (d.paymentIcons || []).filter(function (p) {
            return p.active !== false && (p.name || p.image);
        }),
        copyright: copyrightTemplate.replace(/\{year\}/g, year)
    };
}

module.exports = {
    FooterContent,
    buildDefaults,
    getFooterContent,
    effectiveFooter,
    normShippingZones
};
