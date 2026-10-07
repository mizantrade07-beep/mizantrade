const mongoose = require("mongoose");

const attributeSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true
        },
        values: {
            type: [String],
            default: []
        }
    },
    { timestamps: true }
);

attributeSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model("Attribute", attributeSchema);
