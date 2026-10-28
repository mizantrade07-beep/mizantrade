const mongoose = require("mongoose");

const chatConversationSchema = new mongoose.Schema(
    {
        visitorKey: {
            type: String,
            required: true,
            index: true
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            default: null
        },

        displayName: {
            type: String,
            trim: true,
            maxlength: 120,
            default: "Guest"
        },

        /* "bot" = chatbot answers, "human" = admin has replied, bot stopped */
        mode: {
            type: String,
            enum: ["bot", "human"],
            default: "bot"
        },

        /* Follow-up memory for the assistant (last products shown, etc.) */
        botState: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        modeChangedAt: {
            type: Date,
            default: null
        },

        modeChangedBy: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },

        unreadAdmin: {
            type: Number,
            default: 0,
            min: 0
        },

        lastMessage: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ""
        },

        lastMessageAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

chatConversationSchema.index({ lastMessageAt: -1 });

module.exports =
    mongoose.models.ChatConversation ||
    mongoose.model("ChatConversation", chatConversationSchema);
