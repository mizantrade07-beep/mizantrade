const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("../models/Product");

const imgDir = path.join(__dirname, "..", "public", "images", "products");
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

// সাধারণ SVG প্লেসহোল্ডার ছবি তৈরি করে
function makePlaceholder(slug, label, color1, color2) {
    const safe = String(label).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const words = safe.split(" ");
    const lines = [];
    let line = "";
    words.forEach(function (w) {
        if ((line + " " + w).trim().length > 18) {
            lines.push(line.trim());
            line = w;
        } else {
            line += " " + w;
        }
    });
    if (line.trim()) lines.push(line.trim());

    const textSvg = lines
        .slice(0, 4)
        .map(
            (t, i) =>
            `<text x="200" y="${170 + i * 30}" font-family="Arial" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">${t}</text>`
        )
        .join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/>
</linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/>
<circle cx="200" cy="110" r="46" fill="rgba(255,255,255,0.18)"/>
<text x="200" y="122" font-family="Arial" font-size="40" fill="#ffffff" text-anchor="middle">MT</text>
${textSvg}
</svg>`;

    const file = path.join(imgDir, slug + ".svg");
    fs.writeFileSync(file, svg);
    return "/images/products/" + slug + ".svg";
}

const colors = {
    motherboard: ["#0f2b46", "#1d5a8a"],
    ssd: ["#12331f", "#2e7d46"],
    ram: ["#3a1f0f", "#a05a2c"],
    gpu: ["#2d0f3a", "#7b2fa0"],
    pc: ["#081621", "#374957"],
    acc: ["#401010", "#a03030"]
};

const demoProducts = [
    // ===== Desktop Offer =====
    {
        title: "KingSpec P3 256GB SATA 2.5 Inch SSD (Offer)",
        mainCategory: "desktop-offer", brand: "KingSpec", color: "ssd",
        regularPrice: 2900, salePrice: 2300,
        shortDesc: "<ul><li>256GB SATA III 2.5\" SSD</li><li>Read: 550MB/s</li><li>3 Year Warranty</li></ul>",
        longDesc: "<p>KingSpec P3 সিরিজের ২৫৬জিবি SATA SSD — ডেস্কটপ ও ল্যাপটপ উভয়ের জন্য। ৩ বছরের অফিসিয়াল ওয়ারেন্টি সহ।</p>"
    },

    // ===== PC Bundles =====
    {
        title: "Star PC - Intel Core i5 12400F Gaming Bundle",
        mainCategory: "star-pc", brand: "Mizan Trade", color: "pc",
        regularPrice: 68000, salePrice: 65000,
        shortDesc: "<ul><li>Core i5 12400F</li><li>H610 Motherboard</li><li>16GB DDR4 RAM</li><li>512GB NVMe SSD</li></ul>",
        longDesc: "<p>সম্পূর্ণ গেমিং পিসি বান্ডল — Core i5 12400F প্রসেসর, ১৬জিবি র‍্যাম, ৫১২জিবি NVMe SSD সহ। গ্রাফিক্স কার্ড আলাদাভাবে যোগ করা যাবে।</p>"
    },
    {
        title: "Intel PC - Core i3 12100 Office Bundle",
        mainCategory: "intel-pc", brand: "Mizan Trade", color: "pc",
        regularPrice: 42000,
        shortDesc: "<ul><li>Core i3 12100</li><li>H610 Motherboard</li><li>8GB DDR4 RAM</li><li>256GB SSD</li></ul>",
        longDesc: "<p>অফিস ও ঘরোয়া ব্যবহারের জন্য সাশ্রয়ী Intel Core i3 বান্ডল।</p>"
    },
    {
        title: "Ryzen PC - AMD Ryzen 5 5600G Bundle",
        mainCategory: "ryzen-pc", brand: "Mizan Trade", color: "pc",
        regularPrice: 52000, salePrice: 48000,
        shortDesc: "<ul><li>Ryzen 5 5600G</li><li>B550 Motherboard</li><li>16GB DDR4 RAM</li><li>Radeon Vega Graphics</li></ul>",
        longDesc: "<p>AMD Ryzen 5 5600G বান্ডল — বিল্ট-ইন Vega গ্রাফিক্স সহ, হালকা গেমিং ও প্রোডাক্টিভিটির জন্য পারফেক্ট।</p>"
    },

    // ===== Motherboard =====
    {
        title: "ASUS Prime H610M-K D4 Intel LGA1700 Motherboard",
        mainCategory: "intel-motherboard", brand: "ASUS", color: "motherboard",
        regularPrice: 9800, salePrice: 9200,
        shortDesc: "<ul><li>Intel LGA1700 Socket</li><li>DDR4 Support</li><li>PCIe 4.0 Ready</li></ul>",
        longDesc: "<p>ASUS Prime H610M-K D4 — ১২থ/১৩শ/১৪শ জেনারেশন Intel প্রসেসরের জন্য নির্ভরযোগ্য মাদারবোর্ড।</p>"
    },
    {
        title: "Gigabyte B550M DS3H AMD AM4 Motherboard",
        mainCategory: "amd-motherboard", brand: "Gigabyte", color: "motherboard",
        regularPrice: 11500,
        shortDesc: "<ul><li>AMD AM4 Socket</li><li>Dual Channel DDR4</li><li>PCIe 4.0 M.2</li></ul>",
        longDesc: "<p>Gigabyte B550M DS3H — Ryzen 3000/5000 সিরিজের জন্য মাইক্রো ATX মাদারবোর্ড।</p>"
    },
    {
        title: "MSI PRO B760M-P DDR4 Motherboard",
        mainCategory: "intel-motherboard", brand: "MSI", color: "motherboard",
        regularPrice: 13800, callForPrice: false,
        shortDesc: "<ul><li>Intel LGA1700</li><li>DDR4</li><li>2x M.2 Slots</li></ul>",
        longDesc: "<p>MSI PRO B760M-P — ব্যবসায়িক ও গেমিং বিল্ডের জন্য বাজেট B760 মাদারবোর্ড।</p>"
    },

    // ===== SSD =====
    {
        title: "KingSpec P4 512GB PCIe Gen4 NVMe SSD",
        mainCategory: "nvme-ssd", brand: "KingSpec", color: "ssd",
        regularPrice: 5600, salePrice: 4950,
        shortDesc: "<ul><li>512GB NVMe Gen4</li><li>Read: 5000MB/s</li><li>M.2 2280</li></ul>",
        longDesc: "<p>KingSpec P4 Gen4 NVMe SSD — অফিসিয়াল মিজান ট্রেড ওয়ারেন্টি সহ।</p>"
    },
    {
        title: "AITC Kingsman 1TB SATA 2.5 Inch SSD",
        mainCategory: "desktop-ssd", brand: "AITC", color: "ssd",
        regularPrice: 8200,
        shortDesc: "<ul><li>1TB SATA III</li><li>2.5\" Form Factor</li><li>3 Year Warranty</li></ul>",
        longDesc: "<p>AITC Kingsman ১টিবি SATA SSD — ডেস্কটপ ও ল্যাপটপে ব্যবহারযোগ্য।</p>"
    },
    {
        title: "Samsung 980 1TB NVMe M.2 SSD",
        mainCategory: "nvme-ssd", brand: "Samsung", color: "ssd",
        regularPrice: 11500, salePrice: 10900,
        shortDesc: "<ul><li>1TB PCIe 3.0 NVMe</li><li>Read: 3500MB/s</li><li>5 Year Warranty</li></ul>",
        longDesc: "<p>Samsung 980 — বিশ্বের অন্যতম জনপ্রিয় NVMe SSD।</p>"
    },
    {
        title: "KingSpec 256GB M.2 SATA Laptop SSD",
        mainCategory: "laptop-ssd", brand: "KingSpec", color: "ssd",
        regularPrice: 3100,
        shortDesc: "<ul><li>256GB M.2 SATA</li><li>ল্যাপটাপের জন্য</li></ul>",
        longDesc: "<p>পুরনো ল্যাপটপকে দ্রুত করতে KingSpec M.2 SATA SSD।</p>"
    },

    // ===== RAM =====
    {
        title: "AITC Kingsman Gaming 16GB (2x8GB) DDR4 3200MHz RGB Desktop RAM",
        mainCategory: "desktop-ram", brand: "AITC Kingsman", color: "ram",
        regularPrice: 5800, salePrice: 5400,
        shortDesc: "<ul><li>16GB Kit (2x8GB)</li><li>DDR4 3200MHz</li><li>RGB Lighting</li></ul>",
        longDesc: "<p>AITC Kingsman Gaming RGB র‍্যাম — গেমিং বিল্ডের জন্য স্টাইলিশ ও দ্রুত।</p>"
    },
    {
        title: "Corsair Vengeance LPX 8GB DDR4 3200MHz Desktop RAM",
        mainCategory: "desktop-ram", brand: "Corsair", color: "ram",
        regularPrice: 3400,
        shortDesc: "<ul><li>8GB DDR4</li><li>3200MHz</li><li>Low Profile Heat Spreader</li></ul>",
        longDesc: "<p>Corsair Vengeance LPX — নির্ভরযোগ্য পারফরম্যান্স র‍্যাম।</p>"
    },
    {
        title: "Kingston Fury Impact 8GB DDR4 3200MHz Laptop RAM",
        mainCategory: "laptop-ram", brand: "Kingston", color: "ram",
        regularPrice: 3100, salePrice: 2850,
        shortDesc: "<ul><li>8GB DDR4 SODIMM</li><li>3200MHz</li><li>Plug and Play</li></ul>",
        longDesc: "<p>Kingston Fury Impact ল্যাপটপ র‍্যাম — সহজেই ল্যাপটপ আপগ্রেড করুন।</p>"
    },
    {
        title: "HP 8GB DDR4 3200MHz Laptop RAM (SODIMM)",
        mainCategory: "laptop-ram", brand: "HP", color: "ram",
        regularPrice: 2700,
        shortDesc: "<ul><li>8GB DDR4</li><li>3200MHz</li><li>SODIMM</li></ul>",
        longDesc: "<p>HP অরিজিনাল ল্যাপটপ র‍্যাম মডিউল।</p>"
    },

    // ===== Graphics Card =====
    {
        title: "ASUS Dual GeForce RTX 4060 8GB GDDR6",
        mainCategory: "nvidia-graphics-card", brand: "ASUS", color: "gpu",
        callForPrice: true, regularPrice: null,
        shortDesc: "<ul><li>8GB GDDR6</li><li>DLSS 3 Support</li><li>Dual Fan</li></ul>",
        longDesc: "<p>ASUS Dual RTX 4060 — 1080p গেমিংয়ের সেরা পছন্দ। দাম জানতে কল করুন।</p>"
    },
    {
        title: "Gigabyte Radeon RX 7600 Gaming OC 8GB",
        mainCategory: "amd-graphics-card", brand: "Gigabyte", color: "gpu",
        regularPrice: 39500, salePrice: 38200,
        shortDesc: "<ul><li>8GB GDDR6</li><li>WINDFORCE Cooling</li><li>PCIe 4.0</li></ul>",
        longDesc: "<p>Gigabyte RX 7600 Gaming OC — AMD এর নতুন জেনারেশন গেমিং কার্ড।</p>"
    },
    {
        title: "MSI GeForce RTX 4070 SUPER Ventus 2X 12GB",
        mainCategory: "nvidia-graphics-card", brand: "MSI", color: "gpu",
        callForPrice: true, regularPrice: null,
        shortDesc: "<ul><li>12GB GDDR6X</li><li>DLSS 3</li><li>Ventus 2X Cooling</li></ul>",
        longDesc: "<p>MSI RTX 4070 SUPER — 1440p হাই-এন্ড গেমিং। দাম জানতে কল করুন।</p>"
    },

    // ===== Accessories =====
    {
        title: "PowerSync 4-Port USB 3.0 Hub",
        mainCategory: "accessories", brand: "PowerSync", color: "acc",
        regularPrice: 750, salePrice: 650,
        shortDesc: "<ul><li>4x USB 3.0 Port</li><li>Aluminum Body</li></ul>",
        longDesc: "<p>PowerSync USB হাব — এক পোর্ট থেকে ৪টি ডিভাইস।</p>"
    },
    {
        title: "Unika HDMI Cable 2.0 (1.5 Meter)",
        mainCategory: "accessories", brand: "Unika", color: "acc",
        regularPrice: 450,
        shortDesc: "<ul><li>4K@60Hz Support</li><li>Gold Plated</li><li>1.5m</li></ul>",
        longDesc: "<p>Unika HDMI 2.0 কেবল — 4K আউটপুট সাপোর্ট।</p>"
    }
];

function createSlug(value) {
    return String(value).trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function createSku(slug) {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
        hash = (hash * 31 + slug.charCodeAt(i)) % 1000000;
    }
    return "MT-" + String(hash).padStart(6, "0");
}

async function seedProducts() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected.\n");

        for (const p of demoProducts) {
            const slug = createSlug(p.title);

            const image = makePlaceholder(
                slug,
                p.title.replace(/\s*\(.*\)\s*/, ""),
                colors[p.color][0],
                colors[p.color][1]
            );

            await Product.findOneAndUpdate(
                { slug },
                {
                    $setOnInsert: {
                        title: p.title,
                        slug,
                        sku: createSku(slug),
                        mainCategory: p.mainCategory,
                        subCategory: "",
                        brand: p.brand,
                        regularPrice: p.regularPrice ?? null,
                        salePrice: p.salePrice ?? null,
                        callForPrice: Boolean(p.callForPrice),
                        stockStatus: "In Stock",
                        mainImage: image,
                        galleryImages: [],
                        shortDesc: p.shortDesc,
                        longDesc: p.longDesc,
                        isActive: true
                    }
                },
                { upsert: true, new: true }
            );

            console.log("✔ " + p.title);
        }

        console.log("\nডেমো প্রোডাক্ট সিড সম্পন্ন! অ্যাডমিন প্যানেল থেকে এডিট/ডিলিট করতে পারবেন।");
        process.exit(0);
    } catch (error) {
        console.error("Seed error:", error);
        process.exit(1);
    }
}

seedProducts();
