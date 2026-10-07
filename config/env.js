const dotenv = require("dotenv");

dotenv.config();

function required(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

const config = {
    nodeEnv: process.env.NODE_ENV || "development",

    port: Number(process.env.PORT || 5000),

    mongoUri: required("MONGO_URI"),

    sessionSecret: required("SESSION_SECRET"),

    adminEmail: required("ADMIN_EMAIL").trim().toLowerCase(),

    adminPassword: required("ADMIN_PASSWORD"),

    siteUrl: process.env.SITE_URL || "http://localhost:5000",

    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
        apiKey: process.env.CLOUDINARY_API_KEY || "",
        apiSecret: process.env.CLOUDINARY_API_SECRET || ""
    }
};

module.exports = config;