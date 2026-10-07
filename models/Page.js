const mongoose = require("mongoose");

const pageSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        excerpt: {
            type: String,
            trim: true,
            default: "",
            maxlength: 400
        },

        content: {
            type: String,
            default: ""
        },

        featuredImage: {
            type: String,
            trim: true,
            default: ""
        },

        // info = সাধারণ তথ্য পেজ, full = ফুল-উইডথ পেজ
        template: {
            type: String,
            enum: ["info", "full"],
            default: "info"
        },

        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft"
        },

        showInFooter: {
            type: Boolean,
            default: false
        },

        seo: {
            metaTitle: { type: String, trim: true, default: "" },
            metaDescription: { type: String, trim: true, default: "" },
            keywords: { type: String, trim: true, default: "" }
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.Page ||
    mongoose.model("Page", pageSchema);
