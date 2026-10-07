const mongoose = require("mongoose");

/* ======================================================
   COUPON SCHEMA
   - product coupon: নির্দিষ্ট প্রোডাক্টে প্রযোজ্য (applicableProducts)
   - customer coupon: নির্দিষ্ট কাস্টমারদের জন্য (applicableCustomers)
   - দুটোই খালি থাকলে = সবার জন্য / সব প্রোডাক্টে
====================================================== */

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        discountType: {
            type: String,
            enum: ["percent", "fixed"],
            default: "percent"
        },

        discountValue: {
            type: Number,
            required: true,
            min: 0
        },

        // percent টাইপে সর্বোচ্চ ছাড় (টাকায়) — 0/null মানে সীমা নেই
        maxDiscount: {
            type: Number,
            default: 0,
            min: 0
        },

        // এই টাকার কম অর্ডারে কুপন চলবে না — 0 মানে কোনো ন্যূনতম নেই
        minOrderAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        // খালি = সব প্রোডাক্টে প্রযোজ্য
        applicableProducts: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product"
            }
        ],

        // খালি = সব কাস্টমার (গেস্ট সহ) ব্যবহার করতে পারবে
        applicableCustomers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Customer"
            }
        ],

        // মোট কতবার ব্যবহার করা যাবে — 0/null মানে আনলিমিটেড
        usageLimit: {
            type: Number,
            default: 0,
            min: 0
        },

        usedCount: {
            type: Number,
            default: 0
        },

        startDate: {
            type: Date,
            default: null
        },

        endDate: {
            type: Date,
            default: null
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.Coupon ||
    mongoose.model("Coupon", couponSchema);
