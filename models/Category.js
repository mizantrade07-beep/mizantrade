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

module.exports = mongoose.model("Category", categorySchema);
