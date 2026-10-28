const mongoose = require("mongoose");

const socialLinkSchema = new mongoose.Schema(
    {
        platform: {
            type: String,
            trim: true,
            default: ""
        },

        url: {
            type: String,
            trim: true,
            default: ""
        }
    },
    { _id: false }
);

const teamMemberSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        designation: {
            type: String,
            trim: true,
            default: ""
        },

        photo: {
            type: String,
            trim: true,
            default: ""
        },

        phone: {
            type: String,
            trim: true,
            default: ""
        },

        // Repeatable social profile links (Facebook, Instagram, TikTok ...)
        socials: {
            type: [socialLinkSchema],
            default: []
        },

        order: {
            type: Number,
            default: 0
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

teamMemberSchema.index({ order: 1, createdAt: 1 });

module.exports =
    mongoose.models.TeamMember ||
    mongoose.model("TeamMember", teamMemberSchema);
