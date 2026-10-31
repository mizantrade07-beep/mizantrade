const mongoose = require("mongoose");

const slideSchema = new mongoose.Schema(
    {
        tag: { type: String, trim: true, default: "" },
        title: { type: String, trim: true, default: "" },
        text: { type: String, trim: true, default: "" },
        buttonText: { type: String, trim: true, default: "" },
        buttonLink: { type: String, trim: true, default: "" },
        image: { type: String, trim: true, default: "" },
        // dark overlay opacity over the background photo (0 = none, 100 = solid)
        overlay: { type: Number, default: 75, min: 0, max: 100 },
        // px height of this slide; 0 = theme default
        height: { type: Number, default: 0, min: 0, max: 800 },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

const logoSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: "" },
        image: { type: String, trim: true, default: "" },
        link: { type: String, trim: true, default: "" },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

/* হিরোর পাশের ছোট কার্ড (hotline, delivery ইত্যাদি) */
const sideCardSchema = new mongoose.Schema(
    {
        icon: { type: String, trim: true, default: "fa-solid fa-star" },
        title: { type: String, trim: true, default: "" },
        text: { type: String, trim: true, default: "" },
        linkText: { type: String, trim: true, default: "" },
        link: { type: String, trim: true, default: "" },
        bgColor: { type: String, trim: true, default: "" },
        // background photo; when set it is shown over the colour
        image: { type: String, trim: true, default: "" },
        // dark overlay opacity over the background photo (0 = none, 100 = solid)
        overlay: { type: Number, default: 62, min: 0, max: 100 },
        // px height of this card; 0 = share the hero column height
        height: { type: Number, default: 0, min: 0, max: 800 },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

/* Why choose us — আইকন + টাইটেল + টেক্সট কার্ড */
const whyItemSchema = new mongoose.Schema(
    {
        icon: { type: String, trim: true, default: "fa-solid fa-shield-halved" },
        title: { type: String, trim: true, default: "" },
        text: { type: String, trim: true, default: "" },
        // পুরো কার্ডকে লিংকে পরিণত করে (ঐচ্ছিক), যেমন /page/genuine-products
        link: { type: String, trim: true, default: "" }
    },
    { _id: false }
);

/* হোমপেজ প্রোডাক্ট সেকশন — latest / custom / upcoming / new / stockout কাইন্ড,
   স্কোপ: all | category | subcategory | brand | products (ম্যানুয়াল slug লিস্ট) */
const productSectionSchema = new mongoose.Schema(
    {
        kind: {
            type: String,
            enum: ["latest", "custom", "upcoming", "preorder", "new", "stockout"],
            default: "custom"
        },
        title: { type: String, trim: true, default: "" },
        icon: { type: String, trim: true, default: "" },
        scope: {
            type: String,
            enum: ["all", "category", "subcategory", "childcategory", "brand", "products"],
            default: "all"
        },
        categorySlug: { type: String, trim: true, default: "" },
        brand: { type: String, trim: true, default: "" },
        // কমা-বিচ্ছিন্ন প্রোডাক্ট slug তালিকা (scope = products)
        products: { type: String, trim: true, default: "" },
        count: { type: Number, default: 10, min: 2, max: 24 },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

/* ফুল-উইথ মিডিয়া ব্যানার (ইমেজ বা ভিডিও) — নির্দিষ্ট স্লটে দেখায় */
const imageSectionSchema = new mongoose.Schema(
    {
        kind: {
            type: String,
            enum: ["image", "video"],
            default: "image"
        },
        image: { type: String, trim: true, default: "" },
        // YouTube/Vimeo URL অথবা সরাসরি .mp4/.webm/.ogg লিংক
        video: { type: String, trim: true, default: "" },
        link: { type: String, trim: true, default: "" },
        alt: { type: String, trim: true, default: "" },
        slot: {
            type: String,
            enum: [
                "after-hero",
                "after-featured",
                "after-latest",
                "after-custom",
                "after-upcoming",
                "after-preorder",
                "after-new",
                "after-stockout",
                "before-footer"
            ],
            default: "after-custom"
        },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

/* লেগাসি কাস্টম সেকশন (শুধু পুরোনো ডেটা পড়ার জন্য, নতুন কোড ব্যবহার করে না) */
const customSectionSchema = new mongoose.Schema(
    {
        title: { type: String, trim: true, default: "" },
        source: {
            type: String,
            enum: ["brand", "category", "latest"],
            default: "brand"
        },
        sourceName: { type: String, trim: true, default: "" },
        count: { type: Number, default: 10, min: 2, max: 24 },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

const homeContentSchema = new mongoose.Schema(
    {
        latestProductsCount: {
            type: Number,
            default: 24,
            min: 1,
            max: 48
        },
        heroSlides: { type: [slideSchema], default: [] },
        // হিরো সাইড কলামের প্রস্থ (px); 0 = থিম ডিফল্ট
        heroSideWidth: { type: Number, default: 0, min: 0, max: 600 },
        heroSideCards: { type: [sideCardSchema], default: [] },
        whyTitle: { type: String, trim: true, default: "" },
        whySubtitle: { type: String, trim: true, default: "" },
        whyDescription: { type: String, trim: true, default: "" },
        whyItems: { type: [whyItemSchema], default: [] },
        featEnabled: { type: Boolean, default: true },
        featTitle: { type: String, trim: true, default: "" },
        featSubtitle: { type: String, trim: true, default: "" },
        featDescription: { type: String, trim: true, default: "" },
        featSlugs: { type: [String], default: [] },
        productSections: { type: [productSectionSchema], default: [] },
        imageSections: { type: [imageSectionSchema], default: [] },
        brandSectionTitle: { type: String, trim: true, default: "" },
        brandLogos: { type: [logoSchema], default: [] },
        customSections: { type: [customSectionSchema], default: [] },
        // one-time seed marker: existing rows are migrated only once, so an
        // intentionally deleted row never comes back
        seedVersion: { type: Number, default: 0 }
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.HomeContent ||
    mongoose.model("HomeContent", homeContentSchema);
