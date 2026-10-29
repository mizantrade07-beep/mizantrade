const mongoose = require("mongoose");

/* ======================================================
   SITE SETTINGS (singleton document)
   DB-এ সংরক্ষিত মান config/site.js ডিফল্টের উপরে বসে,
   তাই অ্যাডমিন প্যানেল থেকে বদলালে পুরো সাইটে লাগু হয়।
====================================================== */

/* Payment gateway credentials — admin panel-এ সেট করা হয়,
   checkout-এ enabled/mode দেখে অপশন দেখানো হয়। */
const gatewaySchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: true },
        mode: { type: String, enum: ["sandbox", "live"], default: "sandbox" },
        apiKey: { type: String, trim: true, default: "" },
        apiSecret: { type: String, trim: true, default: "" },
        username: { type: String, trim: true, default: "" },
        password: { type: String, trim: true, default: "" },
        merchantId: { type: String, trim: true, default: "" }
    },
    { _id: false }
);

const settingSchema = new mongoose.Schema(
    {
        siteName: { type: String, trim: true, default: "Mizan Trade" },
        hotline: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, default: "" },
        address: { type: String, trim: true, default: "" },

        /* ---- General site identity ---- */
        general: {
            tagline: { type: String, trim: true, default: "" },
            logoUrl: { type: String, trim: true, default: "" },
            hotline: { type: String, trim: true, default: "" },
            supportPhone: { type: String, trim: true, default: "" },
            operatingHours: { type: String, trim: true, default: "Sat – Thu, 10:00 AM – 8:00 PM" },
            timezone: { type: String, trim: true, default: "Asia/Dhaka" },
            dateFormat: { type: String, trim: true, default: "DD/MM/YYYY" },
            mapUrl: { type: String, trim: true, default: "" }
        },

        /* ---- Localization / language ---- */
        localization: {
            country: { type: String, trim: true, default: "Bangladesh" },
            currency: { type: String, trim: true, default: "BDT" },
            currencySymbol: { type: String, trim: true, default: "৳" },
            defaultLanguage: { type: String, trim: true, default: "en" },
            languages: [
                new mongoose.Schema(
                    {
                        code: { type: String, trim: true, default: "" },
                        name: { type: String, trim: true, default: "" },
                        active: { type: Boolean, default: true }
                    },
                    { _id: false }
                )
            ]
        },

        /* ---- Payment gateway credentials (accounts live in FooterContent) ---- */
        paymentGateways: {
            bkash: { type: gatewaySchema, default: () => ({}) },
            nagad: { type: gatewaySchema, default: () => ({}) },
            rocket: { type: gatewaySchema, default: () => ({}) },
            card: { type: gatewaySchema, default: () => ({}) },
            bank: { type: gatewaySchema, default: () => ({}) },
            cod: {
                enabled: { type: Boolean, default: true }
            }
        },

        /* ---- Courier / delivery ---- */
        courier: {
            provider: { type: String, trim: true, default: "" },
            apiKey: { type: String, trim: true, default: "" },
            apiSecret: { type: String, trim: true, default: "" },
            sandbox: { type: Boolean, default: true },
            freeShippingThreshold: { type: Number, default: 0 },
            deliveryTime: { type: String, trim: true, default: "2–4 working days" }
        },

        /* ---- Tax / VAT ---- */
        tax: {
            enabled: { type: Boolean, default: false },
            label: { type: String, trim: true, default: "VAT" },
            percent: { type: Number, default: 0, min: 0, max: 100 },
            inclusive: { type: Boolean, default: false },
            applyToShipping: { type: Boolean, default: false }
        },

        /* ---- User & security ---- */
        userSecurity: {
            passwordMinLength: { type: Number, default: 6, min: 4, max: 64 },
            requireOtpLogin: { type: Boolean, default: false },
            allowSocialLogin: { type: Boolean, default: true },
            sessionTimeoutMinutes: { type: Number, default: 0, min: 0 },
            csrfEnabled: { type: Boolean, default: false }
        },

        /* ---- Reward points programme ---- */
        rewards: {
            enabled: { type: Boolean, default: true },
            pointValue: { type: Number, default: 1, min: 0 },
            minRedeem: { type: Number, default: 50, min: 0 },
            label: { type: String, trim: true, default: "Reward Points" }
        },

        /* ---- SEO & marketing (tags + manual KPI snapshot) ---- */
        marketing: {
            ga4Id: { type: String, trim: true, default: "" },
            gtmId: { type: String, trim: true, default: "" },
            fbPixelId: { type: String, trim: true, default: "" },
            googleVerification: { type: String, trim: true, default: "" },
            bingVerification: { type: String, trim: true, default: "" },
            fbVerification: { type: String, trim: true, default: "" },
            customHead: { type: String, default: "" },
            customBody: { type: String, default: "" },
            organicVisits: { type: Number, default: 0 },
            googleRanking: { type: Number, default: 0 },
            searchVisibility: { type: Number, default: 0, min: 0, max: 100 },
            brandCredibility: { type: Number, default: 0, min: 0, max: 100 },
            longTermGrowth: { type: Number, default: 0 },
            kpiNote: { type: String, trim: true, default: "" },
            kpiUpdatedAt: { type: Date, default: null }
        },

        /* ---- Product page banner (global fallback, shown under every product's gallery) ---- */
        productBanner: {
            enabled: { type: Boolean, default: false },
            image: { type: String, trim: true, default: "" },
            link: { type: String, trim: true, default: "" }
        },

        /* ---- Per-page meta overrides ---- */
        seoPages: [
            new mongoose.Schema(
                {
                    path: { type: String, trim: true, default: "" },
                    title: { type: String, trim: true, default: "" },
                    description: { type: String, trim: true, default: "" },
                    keywords: { type: String, trim: true, default: "" },
                    robots: {
                        type: String,
                        enum: ["index", "noindex"],
                        default: "index"
                    },
                    active: { type: Boolean, default: true }
                },
                { _id: false }
            )
        ],

        shipping: {
            insideDhaka: { type: Number, default: 60 },
            outsideDhaka: { type: Number, default: 120 }
        },

        bkash: {
            number: { type: String, trim: true, default: "" },
            type: { type: String, trim: true, default: "Personal" },
            chargePercent: { type: Number, default: 1.15 }
        },

        bank: {
            bankName: { type: String, trim: true, default: "" },
            branch: { type: String, trim: true, default: "" },
            accountName: { type: String, trim: true, default: "" },
            accountNumber: { type: String, trim: true, default: "" },
            routingNumber: { type: String, trim: true, default: "" }
        },

        social: {
            facebook: { type: String, trim: true, default: "" },
            instagram: { type: String, trim: true, default: "" },
            youtube: { type: String, trim: true, default: "" },
            whatsapp: { type: String, trim: true, default: "" },
            linkedin: { type: String, trim: true, default: "" }
        },

        /* সোশ্যাল লিংক ম্যানেজার — একাধিক এন্ট্রি, ১৩টি প্ল্যাটফর্ম */
        socials: [
            new mongoose.Schema(
                {
                    platform: {
                        type: String,
                        enum: [
                            "facebook", "youtube", "instagram", "tiktok",
                            "linkedin", "whatsapp", "x", "snapchat",
                            "discord", "threads", "pinterest", "reddit", "telegram"
                        ],
                        required: true
                    },
                    url: { type: String, trim: true, default: "" },
                    label: { type: String, trim: true, default: "" }
                },
                { _id: false }
            )
        ],

        /* টপ প্যানেল — marquee নোটিশ + যোগাযোগ আইটেম + হেডার অ্যাকশন + রং */
        topbar: {
            logoUrl: { type: String, trim: true, default: "" },
            searchPlaceholder: { type: String, trim: true, default: "" },
            notices: [
                new mongoose.Schema(
                    {
                        text: { type: String, trim: true, default: "" },
                        link: { type: String, trim: true, default: "" },
                        textColor: { type: String, trim: true, default: "" },
                        bgColor: { type: String, trim: true, default: "" }
                    },
                    { _id: false }
                )
            ],
            contacts: [
                new mongoose.Schema(
                    {
                        icon: { type: String, trim: true, default: "fa-solid fa-phone" },
                        label: { type: String, trim: true, default: "" },
                        text: { type: String, trim: true, default: "" },
                        link: { type: String, trim: true, default: "" },
                        textColor: { type: String, trim: true, default: "" },
                        bgColor: { type: String, trim: true, default: "" }
                    },
                    { _id: false }
                )
            ],
            actions: [
                new mongoose.Schema(
                    {
                        icon: { type: String, trim: true, default: "fa-solid fa-star" },
                        title: { type: String, trim: true, default: "" },
                        highlight: { type: Boolean, default: false },
                        link: { type: String, trim: true, default: "" },
                        badge: { type: String, enum: ["none", "wishlist", "cart", "compare"], default: "none" },
                        textColor: { type: String, trim: true, default: "" },
                        bgColor: { type: String, trim: true, default: "" },
                        showDesktop: { type: Boolean, default: true },
                        showMobile: { type: Boolean, default: true }
                    },
                    { _id: false }
                )
            ],
            colors: {
                topbarBg: { type: String, trim: true, default: "" },
                topbarText: { type: String, trim: true, default: "" },
                headerBg: { type: String, trim: true, default: "" }
            }
        },

        /* ফুটার কাস্টম ব্লক — টেক্সট/লিংক/ইমেজ/ভিডিও আইটেম */
        footerBlocks: [
            new mongoose.Schema(
                {
                    title: { type: String, trim: true, default: "" },
                    items: [
                        new mongoose.Schema(
                            {
                                type: {
                                    type: String,
                                    enum: ["text", "link", "image", "video"],
                                    default: "text"
                                },
                                text: { type: String, trim: true, default: "" },
                                url: { type: String, trim: true, default: "" },
                                image: { type: String, trim: true, default: "" }
                            },
                            { _id: false }
                        )
                    ]
                },
                { _id: false }
            )
        ],

        footerText: { type: String, trim: true, default: "" },

        metaTitle: { type: String, trim: true, default: "" },
        metaDescription: { type: String, trim: true, default: "" },
        metaKeywords: { type: String, trim: true, default: "" },
        ogImage: { type: String, trim: true, default: "" },
        faviconUrl: { type: String, trim: true, default: "" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
