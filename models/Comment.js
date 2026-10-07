const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true,
            index: true
        },

        // লগইন করা কাস্টমার হলে রেফারেন্স (ঐচ্ছিক)
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            default: null
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: ""
        },

        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        isApproved: {
            type: Boolean,
            default: false,
            index: true
        },

        adminReply: {
            type: String,
            trim: true,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.Comment ||
    mongoose.model("Comment", commentSchema);
