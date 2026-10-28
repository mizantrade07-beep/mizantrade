const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            trim: true,
            default: "Product"
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        offerQty: {
            type: String,
            trim: true,
            default: ""
        },

        // Free text on purpose: "12,500", "Call for price", "১২,৫০০" etc.
        price: {
            type: String,
            trim: true,
            default: ""
        },

        gift: {
            type: String,
            trim: true,
            default: ""
        },

        order: {
            type: Number,
            default: 0
        },

        /* Card width on the Offers page: full = 1/1, half = 1/2,
           third = 1/3, quarter = 1/4 of the row. */
        layout: {
            type: String,
            enum: ["full", "half", "third", "quarter"],
            default: "full"
        },

        isActive: {
            type: Boolean,
            default: true
        },

        /* Scope — category slugs and product ids this offer is meant for.
           Empty scope arrays = a general offer shown to everyone. */
        categories: [{ type: String, trim: true }],
        subCategories: [{ type: String, trim: true }],
        childCategories: [{ type: String, trim: true }],
        products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

        banner: {
            type: String,
            trim: true,
            default: ""
        },

        // Rich content (Word/Excel import, tables, formulas)
        content: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

offerSchema.index({ type: 1, order: 1 });

module.exports =
    mongoose.models.Offer ||
    mongoose.model("Offer", offerSchema);
