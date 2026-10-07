const bcrypt = require("bcryptjs");

const config = require("../config/env");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");

async function seedAdmin() {
    try {
        await connectDB();

        const email = config.adminEmail;

        const existingAdmin = await Admin.findOne({
            email
        });

        if (existingAdmin) {
            console.log("");
            console.log("Admin account already exists.");
            console.log(`Email: ${email}`);
            console.log("");
            console.log(
                "Use npm run reset:admin if you need to reset the password."
            );

            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash(
            config.adminPassword,
            12
        );

        const admin = await Admin.create({
            name: "MizanTrade Administrator",

            email,

            password: hashedPassword,

            role: "super_admin",

            isActive: true
        });

        console.log("");
        console.log("=================================");
        console.log("Admin account created successfully");
        console.log("=================================");
        console.log(`ID: ${admin._id}`);
        console.log(`Email: ${admin.email}`);
        console.log(`Role: ${admin.role}`);
        console.log("");

        process.exit(0);

    } catch (error) {
        console.error("");
        console.error("ADMIN SEED FAILED:");
        console.error(error);
        console.error("");

        process.exit(1);
    }
}

seedAdmin();