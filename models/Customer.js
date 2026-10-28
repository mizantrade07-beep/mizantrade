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
            required: false,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
            index: true
        },

        phone: {
            type: String,
            trim: true,
            default: "",
            index: true
        },

        password: {
            type: String,
            required: false,
            select: false
        },

        // "password", "email"/"phone" (OTP verified) or a social provider
        authProvider: {
            type: String,
            enum: ["password", "phone", "email", "google", "facebook", "tiktok"],
            default: "password"
        },

        googleId: {
            type: String,
            trim: true,
            default: "",
            index: true
        },

        facebookId: {
            type: String,
            trim: true,
            default: "",
            index: true
        },

        tiktokId: {
            type: String,
            trim: true,
            default: "",
            index: true
        },

        emailVerified: {
            type: Boolean,
            default: false
        },

        phoneVerified: {
            type: Boolean,
            default: false
        },

        securityQuestion: {
            type: String,
            trim: true,
            default: ""
        },

        // bcrypt hash of the lowercased, trimmed answer
        securityAnswer: {
            type: String,
            select: false,
            default: ""
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

        // মেম্বারশিপ টিয়ার — অ্যাডমিন পরিবর্তন করতে পারেন
        tier: {
            type: String,
            enum: ["Star", "Silver", "Platinum"],
            default: "Star"
        },

        // Reward points balance — অর্ডারের সময় অটো যোগ হয়
        rewardPoints: {
            type: Number,
            default: 0,
            min: 0
        },

        // Points ledger — earn / redeem / admin adjustment
        pointsHistory: [
            new mongoose.Schema(
                {
                    type: {
                        type: String,
                        enum: ["earn", "redeem", "adjust"],
                        default: "earn"
                    },
                    points: { type: Number, default: 0 },
                    orderNumber: { type: String, trim: true, default: "" },
                    note: { type: String, trim: true, default: "" }
                },
                { timestamps: true, _id: false }
            )
        ],

        // Store credit balance — অ্যাডমিন ম্যানুয়ালি অ্যাডজাস্ট করেন
        storeCredit: {
            type: Number,
            default: 0,
            min: 0
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
