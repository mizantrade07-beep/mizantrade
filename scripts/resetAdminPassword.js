const bcrypt = require("bcryptjs");

const config = require("../config/env");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");

async function resetAdminPassword() {
    try {
        await connectDB();

        const email = config.adminEmail;

        const admin = await Admin.findOne({
            email
        });

        if (!admin) {
            console.log("");
            console.log("Admin account not found.");
            console.log(`Email searched: ${email}`);
            console.log("");
            console.log(
                "Run npm run seed:admin first."
            );

            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(
            config.adminPassword,
            12
        );

        admin.password = hashedPassword;
        admin.isActive = true;

        await admin.save();

        console.log("");
        console.log("=================================");
        console.log("Admin password reset successfully");
        console.log("=================================");
        console.log(`Email: ${email}`);
        console.log("");

        process.exit(0);

    } catch (error) {
        console.error("");
        console.error("PASSWORD RESET FAILED:");
        console.error(error);
        console.error("");

        process.exit(1);
    }
}

resetAdminPassword();