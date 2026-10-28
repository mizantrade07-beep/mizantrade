const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
    {
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ChatConversation",
            required: true,
            index: true
        },

        sender: {
            type: String,
            enum: ["visitor", "bot", "admin"],
            required: true
        },

        senderName: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },

        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        /* Browser-generated id so a retried send is not stored twice */
        clientId: {
            type: String,
            trim: true,
            maxlength: 80,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

chatMessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports =
    mongoose.models.ChatMessage ||
    mongoose.model("ChatMessage", chatMessageSchema);
