const mongoose = require("mongoose");

const { stockRank } = require("../utils/stock");


/* ======================================================
   REVIEW SCHEMA
====================================================== */

const reviewSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        comment: {
            type: String,
            required: true,
            trim: true
        },

        isApproved: {
            type: Boolean,
            default: false
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    }
);


/* ======================================================
   QUESTION SCHEMA
====================================================== */

const questionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        question: {
            type: String,
            required: true,
            trim: true
        },

        answer: {
            type: String,
            trim: true,
            default: ""
        },

        isApproved: {
            type: Boolean,
            default: false
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    }
);


/* ======================================================
   PRODUCT SCHEMA
====================================================== */

const productSchema = new mongoose.Schema(
    {
        title: {
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

        sku: {
            type: String,
            trim: true,
            uppercase: true,
            unique: true,
            sparse: true
        },

        mainCategory: {
            type: String,
            required: true,
            trim: true
        },

        subCategory: {
            type: String,
            trim: true,
            default: ""
        },

        childCategory: {
            type: String,
            trim: true,
            default: ""
        },

        brand: {
            type: String,
            trim: true,
            default: ""
        },

        regularPrice: {
            type: Number,
            default: null,
            min: 0
        },

        salePrice: {
            type: Number,
            default: null,
            min: 0
        },

        callForPrice: {
            type: Boolean,
            default: false
        },

        // Reward points earned per unit when a customer buys this product
        rewardPoints: {
            type: Number,
            default: 0,
            min: 0
        },

        stockStatus: {
            type: String,
            enum: [
                "In Stock",
                "Out of Stock",
                "Pre Order",
                "Coming Soon"
            ],
            default: "In Stock"
        },

        mainImage: {
            type: String,
            default: ""
        },

        galleryImages: {
            type: [String],
            default: []
        },

        // Product-page sidebar banner (under the image gallery).
        // Empty means the global banner from Settings is used.
        bannerImage: {
            type: String,
            trim: true,
            default: ""
        },

        bannerLink: {
            type: String,
            trim: true,
            default: ""
        },

        shortDesc: {
            type: String,
            trim: true,
            default: ""
        },

        longDesc: {
            type: String,
            default: ""
        },

        specs: {
            type: [
                {
                    key: {
                        type: String,
                        trim: true
                    },
                    value: {
                        type: String,
                        trim: true
                    }
                }
            ],
            default: []
        },

        reviews: {
            type: [reviewSchema],
            default: []
        },

        questions: {
            type: [questionSchema],
            default: []
        },

        isActive: {
            type: Boolean,
            default: true
        },

        // হোমপেজের "New Products" সেকশনে দেখানো হবে
        isNewArrival: {
            type: Boolean,
            default: false
        },

        // 0 = In Stock, 1 = Pre Order, 2 = Coming Soon, 3 = Out of Stock
        stockRank: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);


productSchema.pre("save", function (next) {
    this.stockRank = stockRank(this.stockStatus);
    next();
});

// শপ/হোম লিস্টিং ও সার্চের জন্য ইনডেক্স
productSchema.index({ isActive: 1, mainCategory: 1 });
productSchema.index({ stockRank: 1, createdAt: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isActive: 1, stockRank: 1, createdAt: -1 });
productSchema.index({ title: "text", brand: "text" });


module.exports =
    mongoose.models.Product ||
    mongoose.model("Product", productSchema);