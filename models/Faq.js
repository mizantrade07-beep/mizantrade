const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        question: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300
        },

        answer: {
            type: String,
            required: true
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

faqSchema.index({ category: 1, order: 1 });

module.exports =
    mongoose.models.Faq ||
    mongoose.model("Faq", faqSchema);
