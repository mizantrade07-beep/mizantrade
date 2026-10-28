/* Shared normalisers for payment accounts + payment icons (FooterContent). */

function str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function text(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/\r\n/g, "\n")
        .trim();
}

function isActive(value) {
    return value === true || value === "on" || value === "true" || value === "1";
}

function num(value, def, min, max) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = def;
    if (n < min) n = min;
    if (n > max) n = max;
    return Math.round(n * 100) / 100;
}

function rowsOf(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return Object.values(value);
    return [];
}

const ACCOUNT_TYPES = ["bkash", "nagad", "rocket", "bank"];

function normPaymentAccounts(value) {
    return rowsOf(value)
        .map(function (r) {
            const type = ACCOUNT_TYPES.indexOf(str(r.type)) !== -1 ? str(r.type) : "bkash";
            return {
                type: type,
                label: str(r.label),
                number: str(r.number),
                accountType: str(r.accountType),
                chargePercent: num(r.chargePercent, 0, 0, 100),
                bankName: str(r.bankName),
                branch: str(r.branch),
                accountName: str(r.accountName),
                accountNumber: str(r.accountNumber),
                routingNumber: str(r.routingNumber),
                qrImage: str(r.qrImage),
                instructions: text(r.instructions),
                active: isActive(r.active)
            };
        })
        .filter(function (r) {
            return r.type === "bank"
                ? (r.bankName || r.accountNumber || r.qrImage)
                : (r.number || r.qrImage);
        });
}

function normPaymentIcons(value) {
    return rowsOf(value)
        .map(function (r) {
            return {
                name: str(r.name),
                image: str(r.image),
                active: isActive(r.active)
            };
        })
        .filter(function (r) { return r.name || r.image; });
}

module.exports = { normPaymentAccounts, normPaymentIcons };
