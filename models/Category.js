const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },

    icon: {
        type: String,
        trim: true,
        default: "fa-solid fa-microchip"
    },

    // "" মানে টপ-লেভেল ক্যাটাগরি, নাহয় প্যারেন্টের slug
    parent: {
        type: String,
        trim: true,
        default: ""
    },

    brands: [{
        type: String,
        trim: true
    }],

    // হোমপেজে সেকশন হিসেবে দেখাবে কিনা
    showOnHome: {
        type: Boolean,
        default: false
    },

    order: {
        type: Number,
        default: 0
    },

    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

/* siteData and homepage section scoping read active categories sorted by
   order/name on every cold cache. Without this it is a full collection scan. */
categorySchema.index({ isActive: 1, order: 1, name: 1 });
categorySchema.index({ parent: 1 });

module.exports = mongoose.model("Category", categorySchema);
