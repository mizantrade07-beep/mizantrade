const mongoose = require("mongoose");

/* ======================================================
   SITE SETTINGS (singleton document)
   DB-এ সংরক্ষিত মান config/site.js ডিফল্টের উপরে বসে,
   তাই অ্যাডমিন প্যানেল থেকে বদলালে পুরো সাইটে লাগু হয়।
====================================================== */

const settingSchema = new mongoose.Schema(
    {
        siteName: { type: String, trim: true, default: "Mizan Trade" },
        hotline: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, default: "" },
        address: { type: String, trim: true, default: "" },

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

        footerText: { type: String, trim: true, default: "" },

        metaTitle: { type: String, trim: true, default: "" },
        metaDescription: { type: String, trim: true, default: "" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
