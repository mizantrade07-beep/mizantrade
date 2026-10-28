const mongoose = require("mongoose");

/* Anonymous storefront visitor per day — session id hash only, no PII. */
const trafficVisitorSchema = new mongoose.Schema(
    {
        day: { type: String, required: true, index: true },
        visitor: { type: String, required: true },
        lastSeen: { type: Date, default: Date.now, index: true }
    },
    { timestamps: true }
);

trafficVisitorSchema.index({ day: 1, visitor: 1 }, { unique: true });

module.exports = mongoose.model("TrafficVisitor", trafficVisitorSchema);
