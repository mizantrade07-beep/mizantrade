const mongoose = require("mongoose");

/* Daily aggregate of storefront visits (source: server-side, privacy-safe). */
const trafficDailySchema = new mongoose.Schema(
    {
        day: { type: String, required: true, unique: true, index: true },
        views: { type: Number, default: 0 },
        visitors: { type: Number, default: 0 },
        organic: { type: Number, default: 0 },
        social: { type: Number, default: 0 },
        referral: { type: Number, default: 0 }
    },
    { timestamps: true }
);

module.exports = mongoose.model("TrafficDaily", trafficDailySchema);
