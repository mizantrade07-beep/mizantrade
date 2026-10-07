/* লাইভ সাইট (mizantrade.com) থেকে নেওয়া আসল কনটেন্ট দিয়ে
   ইনফো পেজগুলোকে DB-তে সিংক/আপডেট করে। নতুন পেজ থাকলে তৈরি করে।
   চালান: node scripts/syncLivePages.js
   কনটেন্টের উৎস: controllers/infoController.js -> defaults */

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Page = require("../models/Page");
const { defaults } = require("../controllers/infoController");

// 'blog' আলাদা ব্লগ সিস্টেম — সিংক করা হবে না
const SKIP = ["blog"];

(async () => {
    await connectDB();

    let created = 0;
    let updated = 0;

    for (const slug of Object.keys(defaults)) {
        if (SKIP.includes(slug)) continue;

        const def = defaults[slug];
        const existing = await Page.findOne({ slug });

        if (existing) {
            existing.title = def.title;
            existing.content = def.content;
            existing.seo = existing.seo || {};
            existing.seo.metaTitle = def.title;
            if (!existing.seo.metaDescription) {
                existing.seo.metaDescription = String(def.content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
            }
            await existing.save();
            updated++;
        } else {
            await Page.create({
                title: def.title,
                slug,
                content: def.content,
                excerpt: "",
                template: "info",
                status: "published",
                showInFooter: false,
                seo: {
                    metaTitle: def.title,
                    metaDescription: String(def.content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
                    keywords: ""
                }
            });
            created++;
        }
    }

    console.log(`Live pages synced: created=${created}, updated=${updated}`);

    await mongoose.disconnect();
    process.exit(0);
})();
