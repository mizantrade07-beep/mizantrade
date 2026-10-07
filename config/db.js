const mongoose = require("mongoose");
const config = require("./env");

async function connectDB() {
    try {
        await mongoose.connect(config.mongoUri);

        console.log("MongoDB connected successfully.");
    } catch (error) {
        console.error("MongoDB connection failed:");
        console.error(error.message);

        process.exit(1);
    }
}

module.exports = connectDB;