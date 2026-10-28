const mongoose = require("mongoose");

/* ফুটার তথ্য — সাইটের নিচের অংশ পুরোটাই এখান থেকে রেন্ডার হয় */
const footerInfoBlockSchema = new mongoose.Schema(
    {
        kind: {
            type: String,
            enum: ["text", "image", "video"],
            default: "text"
        },
        title: { type: String, trim: true, default: "" },
        // একাধিক লাইন রাখা যায়; রেন্ডারে newline → <br>
        text: { type: String, trim: true, default: "" },
        image: { type: String, trim: true, default: "" },
        // YouTube/Vimeo URL, direct .mp4/.webm file, or any embed URL.
        video: { type: String, trim: true, default: "" },
        link: { type: String, trim: true, default: "" },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

const footerLinkSchema = new mongoose.Schema(
    {
        label: { type: String, trim: true, default: "" },
        url: { type: String, trim: true, default: "" },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

const footerColumnSchema = new mongoose.Schema(
    {
        title: { type: String, trim: true, default: "" },
        links: { type: [footerLinkSchema], default: [] },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

const footerMembershipSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: "" },
        image: { type: String, trim: true, default: "" },
        link: { type: String, trim: true, default: "" },
        // px; 0 = theme default
        height: { type: Number, default: 0, min: 0, max: 200 },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

/* ডেলিভারি চার্জ — এরিয়া / থানা / পোস্টাল অনুযায়ী একাধিক জোন */
const shippingZoneSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: "" },
        area: { type: String, trim: true, default: "" },
        thana: { type: String, trim: true, default: "" },
        postalCodes: { type: String, trim: true, default: "" },
        charge: { type: Number, default: 0, min: 0 },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

/* পেমেন্ট অ্যাকাউন্ট — বিকাশ/নগদ/রকেট/ব্যাংক, একাধিক অ্যাকাউন্ট */
const paymentAccountSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["bkash", "nagad", "rocket", "bank"],
            default: "bkash"
        },
        label: { type: String, trim: true, default: "" },
        number: { type: String, trim: true, default: "" },
        accountType: { type: String, trim: true, default: "" },
        chargePercent: { type: Number, default: 0, min: 0 },
        bankName: { type: String, trim: true, default: "" },
        branch: { type: String, trim: true, default: "" },
        accountName: { type: String, trim: true, default: "" },
        accountNumber: { type: String, trim: true, default: "" },
        routingNumber: { type: String, trim: true, default: "" },
        qrImage: { type: String, trim: true, default: "" },
        instructions: { type: String, trim: true, default: "" },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

const paymentIconSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: "" },
        image: { type: String, trim: true, default: "" },
        active: { type: Boolean, default: true }
    },
    { _id: false }
);

const footerContentSchema = new mongoose.Schema(
    {
        logo: {
            image: { type: String, trim: true, default: "" },
            link: { type: String, trim: true, default: "" },
            height: { type: Number, default: 45, min: 0, max: 200 },
            mobileHeight: { type: Number, default: 36, min: 0, max: 200 }
        },
        infoBlocks: { type: [footerInfoBlockSchema], default: [] },
        columns: { type: [footerColumnSchema], default: [] },
        memberships: { type: [footerMembershipSchema], default: [] },
        membershipTitle: { type: String, trim: true, default: "Membership" },
        shippingZones: { type: [shippingZoneSchema], default: [] },
        paymentAccounts: { type: [paymentAccountSchema], default: [] },
        paymentIcons: { type: [paymentIconSchema], default: [] },
        // {year} লেখা থাকে স্বয়ংক্রিয়ভাবে চলতি বছর বসে
        copyrightText: { type: String, trim: true, default: "" }
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.FooterContent ||
    mongoose.model("FooterContent", footerContentSchema);
