/* এককালীন সিড: বিল্ট-ইন ইনফো পেজগুলোকে DB-তে Page ডকুমেন্ট হিসেবে যুক্ত করে,
   যাতে অ্যাডমিন প্যানেল (Pages CMS) থেকে এডিট করা যায়।
   চালান: node scripts/seedPages.js */

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Page = require("../models/Page");
const { defaults } = require("../controllers/infoController");

// 'blog' এখন আলাদা ব্লগ সিস্টেম, তাই সিড করা হবে না
const SKIP = ["blog"];

(async () => {
    await connectDB();

    let created = 0;
    let skipped = 0;

    for (const slug of Object.keys(defaults)) {
        if (SKIP.includes(slug)) continue;

        const exists = await Page.findOne({ slug }).select("_id");
        if (exists) {
            skipped++;
            continue;
        }

        const def = defaults[slug];

        await Page.create({
            title: def.title,
            slug,
            content: def.content,
            excerpt: "",
            template: "info",
            status: "published",
            showInFooter: false,
            seo: { metaTitle: def.title, metaDescription: "", keywords: "" }
        });

        created++;
    }

    console.log(`Pages seeded: created=${created}, skipped(existing)=${skipped}`);

    await mongoose.disconnect();
    process.exit(0);
})();
