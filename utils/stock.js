const STOCK_ORDER = [
    "In Stock",
    "Pre Order",
    "Coming Soon",
    "Out of Stock"
];

function stockRank(status) {
    const index = STOCK_ORDER.indexOf(String(status || "").trim());

    return index === -1 ? STOCK_ORDER.length : index;
}

module.exports = {
    STOCK_ORDER,
    stockRank
};
