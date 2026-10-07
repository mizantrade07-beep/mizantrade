const mongoose = require("mongoose");
require("dotenv").config();

const Category = require("../models/Category");

// ডিফল্ট ক্যাটাগরি লিস্ট (প্রয়োজনে এডিট করে আবার রান করুন)
const defaultCategories = [
    // হোমপেজ অফার সেকশন
    { name: "Desktop Offer", slug: "desktop-offer", icon: "fa-solid fa-tags", showOnHome: true, order: 1 },
    { name: "Star PC", slug: "star-pc", icon: "fa-solid fa-star", showOnHome: true, order: 2 },
    { name: "Intel PC", slug: "intel-pc", icon: "fa-solid fa-microchip", showOnHome: true, order: 3 },
    { name: "Ryzen PC", slug: "ryzen-pc", icon: "fa-solid fa-bolt", showOnHome: true, order: 4 },

    // মূল ক্যাটাগরি
    { name: "Motherboard", slug: "motherboard", icon: "fa-solid fa-server", order: 10 },
    { name: "Intel Motherboard", slug: "intel-motherboard", parent: "motherboard", order: 11, brands: ["ASUS", "Gigabyte", "MSI", "ASRock"] },
    { name: "AMD Motherboard", slug: "amd-motherboard", parent: "motherboard", order: 12, brands: ["ASUS", "Gigabyte", "MSI", "ASRock"] },

    { name: "SSD", slug: "ssd", icon: "fa-solid fa-hard-drive", order: 20 },
    { name: "Desktop SSD", slug: "desktop-ssd", parent: "ssd", order: 21, brands: ["KingSpec", "AITC", "Samsung", "Western Digital"] },
    { name: "Laptop SSD", slug: "laptop-ssd", parent: "ssd", order: 22, brands: ["KingSpec", "AITC", "Samsung"] },
    { name: "NVMe SSD", slug: "nvme-ssd", parent: "ssd", order: 23, brands: ["KingSpec", "AITC", "Samsung", "HP"] },

    { name: "Desktop RAM", slug: "desktop-ram", icon: "fa-solid fa-memory", order: 30, brands: ["AITC Kingsman", "Corsair", "G.Skill", "Kingston"] },
    { name: "Laptop RAM", slug: "laptop-ram", icon: "fa-solid fa-laptop", order: 40, brands: ["AITC", "Corsair", "Kingston", "HP"] },

    { name: "Graphics Card", slug: "graphics-card", icon: "fa-solid fa-display", order: 50 },
    { name: "NVIDIA Graphics Card", slug: "nvidia-graphics-card", parent: "graphics-card", order: 51, brands: ["ASUS", "MSI", "Gigabyte", "Zotac"] },
    { name: "AMD Graphics Card", slug: "amd-graphics-card", parent: "graphics-card", order: 52, brands: ["ASUS", "Sapphire", "PowerColor"] },

    { name: "Accessories", slug: "accessories", icon: "fa-solid fa-keyboard", order: 60, brands: ["PowerSync", "Unika", "Xentrha"] }
];

async function seedCategories() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected.");

        for (const category of defaultCategories) {
            await Category.findOneAndUpdate(
                { slug: category.slug },
                { $setOnInsert: category },
                { upsert: true, new: true }
            );
            console.log("✔ " + category.name);
        }

        console.log("\nক্যাটাগরি সিড সম্পন্ন হয়েছে!");
        process.exit(0);
    } catch (error) {
        console.error("Seed error:", error);
        process.exit(1);
    }
}

seedCategories();
