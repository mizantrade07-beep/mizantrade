const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        role: {
            type: String,
            enum: ["super_admin", "admin", "editor", "sub_editor"],
            default: "admin"
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

module.exports =
    mongoose.models.Admin ||
    mongoose.model("Admin", adminSchema);