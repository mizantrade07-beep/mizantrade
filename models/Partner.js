const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema(
    {
        // Approved partner application this login was created from.
        partnerRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PartnerRequest",
            default: null
        },

        companyName: {
            type: String,
            required: true,
            trim: true
        },

        ownerName: {
            type: String,
            trim: true,
            default: ""
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
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

        isActive: {
            type: Boolean,
            default: true
        },

        approvedAt: {
            type: Date,
            default: null
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

module.exports =
    mongoose.models.Partner ||
    mongoose.model("Partner", partnerSchema);
