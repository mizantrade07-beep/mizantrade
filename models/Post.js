const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 180
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

        coverImage: {
            type: String,
            trim: true,
            default: ""
        },

        tags: {
            type: [String],
            default: []
        },

        author: {
            type: String,
            trim: true,
            default: "Mizan Trade"
        },

        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft"
        },

        publishedAt: {
            type: Date,
            default: null
        },

        views: {
            type: Number,
            default: 0
        },

        allowComments: {
            type: Boolean,
            default: true
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
    mongoose.models.Post ||
    mongoose.model("Post", postSchema);
