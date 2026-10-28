const siteConfig = require("../config/site");

function config() {
    const r = siteConfig.rewards || {};

    return {
        enabled: r.enabled !== false,
        pointValue: r.pointValue === undefined ? 1 : Number(r.pointValue) || 0,
        minRedeem: r.minRedeem === undefined ? 50 : Number(r.minRedeem) || 0,
        label: r.label || "Reward Points"
    };
}

function roundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function pointsValue(points) {
    return roundMoney((Number(points) || 0) * config().pointValue);
}

/* Highest number of whole points a customer may spend against `payable`. */
function maxRedeemable(balance, payable) {
    const cfg = config();

    if (!cfg.enabled || cfg.pointValue <= 0) return 0;

    const points = Math.floor(Number(balance) || 0);
    if (points < cfg.minRedeem) return 0;

    const cappedByPayable = Math.floor(
        Math.max(0, Number(payable) || 0) / cfg.pointValue
    );

    return Math.max(0, Math.min(points, cappedByPayable));
}

module.exports = {
    config,
    pointsValue,
    maxRedeemable,
    roundMoney
};
