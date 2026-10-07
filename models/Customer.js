const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },

        phone: {
            type: String,
            trim: true,
            default: ""
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        address: {
            type: String,
            trim: true,
            default: ""
        },

        city: {
            type: String,
            trim: true,
            default: ""
        },

        district: {
            type: String,
            trim: true,
            default: ""
        },

        postalCode: {
            type: String,
            trim: true,
            default: ""
        },

        gender: {
            type: String,
            enum: ["", "male", "female", "other"],
            default: ""
        },

        dateOfBirth: {
            type: Date,
            default: null
        },

        avatar: {
            type: String,
            trim: true,
            default: ""
        },

        // অ্যাডমিনের জন্য অভ্যন্তরীণ নোট
        notes: {
            type: String,
            trim: true,
            default: ""
        },

        isActive: {
            type: Boolean,
            default: true
        },

        lastLoginAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// লগইন ট্র্যাকিং ও ফিল্টারের জন্য ইনডেক্স
customerSchema.index({ lastLoginAt: -1 });
customerSchema.index({ isActive: 1 });
customerSchema.index({ createdAt: -1 });

module.exports =
    mongoose.models.Customer ||
    mongoose.model("Customer", customerSchema);
