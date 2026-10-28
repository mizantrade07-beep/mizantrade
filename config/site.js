// General website configuration (shipping charges, payment numbers, etc.)
module.exports = {
    siteName: "Mizan Trade",

    hotline: "+8801709967815",

    email: "support@mizantrade.com",

    shipping: {
        insideDhaka: 80,
        outsideDhaka: 120
    },

    // Order notifications — emails + SMS sent on every new order.
    // Override with env ADMIN_NOTIFY_EMAILS / ADMIN_NOTIFY_PHONES (comma-separated).
    notifications: {
        adminEmails: [
            "admin@mizantrade.com",
            "mizantrade07@gmail.com"
        ],
        adminPhones: [
            "01709867815"
        ]
    },

    bkash: {
        number: "01709967815",
        type: "Personal",
        chargePercent: 1.15
    },

    bank: {
        bankName: "Islami Bank Bangladesh PLC",
        branch: "New Elephant Road Branch, Dhaka",
        accountName: "Mizan Trade",
        accountNumber: "20503550200XXXXX",
        routingNumber: "225260436"
    }
};