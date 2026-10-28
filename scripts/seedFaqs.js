/* FAQ seed — প্রথমবার চালালে ডিফল্ট FAQ কনটেন্ট ডাটাবেজে যোগ হয়।
   পুনরায় চালালে ডুপ্লিকেট হয় না (question + category মিল থাকলে skip)। */
require("dotenv").config();

const mongoose = require("mongoose");
const Faq = require("../models/Faq");

const FAQS = [
    // ---------- General Information ----------
    {
        category: "General Information",
        question: "What is Mizan Trade?",
        answer: "<p>Mizan Trade is one of Bangladesh's trusted computer hardware and accessories importers and wholesale distributors. We supply genuine SSDs, RAMs, motherboards, graphics cards, casing, power supplies and other PC components to retail shops and corporate clients across the country from our Dhaka showroom at New Elephant Road.</p>"
    },
    {
        category: "General Information",
        question: "Where is your showroom located?",
        answer: "<p>Our showroom is at Shop No 301-303, Level 3, 69-71 New Elephant Road, Dhaka. We are open Saturday to Thursday, 10:00 AM – 8:00 PM.</p>"
    },
    {
        category: "General Information",
        question: "How can I contact Mizan Trade?",
        answer: "<p>You can reach us by phone at our hotline, by email at support@mizantrade.com, or through the contact form on our website. All phone numbers and email addresses on our site are clickable for your convenience.</p>"
    },

    // ---------- Dealer Registration & Wholesale Pricing ----------
    {
        category: "Dealer Registration & Wholesale Pricing",
        question: "How do I become a dealer / partner?",
        answer: "<p>Visit our <a href=\"/become-a-partner\">Become a Partner</a> page and submit the registration form with your business details and trade licence. Our team will review your application and contact you. Once approved, you will get partner login access with dealer pricing.</p>"
    },
    {
        category: "Dealer Registration & Wholesale Pricing",
        question: "Is there a minimum order quantity for wholesale?",
        answer: "<p>Wholesale pricing is available on bulk quantities. The minimum order value and quantity vary by product category. Approved dealers can see exact wholesale prices after logging in to their partner account.</p>"
    },
    {
        category: "Dealer Registration & Wholesale Pricing",
        question: "What documents are required for dealer registration?",
        answer: "<p>You will need a valid trade licence, your shop or business address, a contact mobile number and an email address. Corporate clients may also be asked for their TIN certificate.</p>"
    },

    // ---------- Product Pricing & Availability ----------
    {
        category: "Product Pricing & Availability",
        question: "Are your prices inclusive of VAT?",
        answer: "<p>Prices shown on the website are retail prices. Wholesale and dealer prices are shown separately to approved partners after login. For VAT-inclusive invoicing, please mention it when placing your order.</p>"
    },
    {
        category: "Product Pricing & Availability",
        question: "The product I want shows out of stock. When will it be available?",
        answer: "<p>Stock updates regularly as new shipments arrive. For high-demand items you can contact our hotline and we will notify you as soon as the product is back in stock, or suggest an equivalent alternative.</p>"
    },

    // ---------- Ordering Process ----------
    {
        category: "Ordering Process",
        question: "How do I place an order?",
        answer: "<p>Add products to your cart, go to checkout, fill in your delivery details and choose a payment method (bKash, Cash on Delivery or Bank Transfer). You will receive an order number (e.g. MT-20261014-4F8K) by email and SMS once the order is placed.</p>"
    },
    {
        category: "Ordering Process",
        question: "How can I track my order?",
        answer: "<p>Use our <a href=\"/order-tracking\">Order Tracking</a> page. Enter your order number and the mobile number used at checkout to see the real-time status of your shipment.</p>"
    },
    {
        category: "Ordering Process",
        question: "Can I cancel or change my order after placing it?",
        answer: "<p>Yes, if the order has not yet been dispatched. Contact our hotline as soon as possible with your order number and we will help you cancel or modify it.</p>"
    },

    // ---------- Payment Methods ----------
    {
        category: "Payment Methods",
        question: "Which payment methods do you accept?",
        answer: "<p>We accept bKash Send Money (a 1.15% charge applies), Cash on Delivery, and Bank Transfer. Details for each method are shown at checkout and on our <a href=\"/pages/payment-methods\">Payment Methods</a> page.</p>"
    },
    {
        category: "Payment Methods",
        question: "How does bKash payment work?",
        answer: "<p>At checkout select bKash, send the total amount via Send Money to the number shown with the QR code, and enter the Transaction ID (TrxID). A 1.15% bKash charge is added automatically so you don't need to calculate it yourself.</p>"
    },

    // ---------- Delivery & Shipping ----------
    {
        category: "Delivery & Shipping",
        question: "What are the delivery charges?",
        answer: "<p>Inside Dhaka the delivery charge is ৳80 and outside Dhaka it is ৳120 for Cash on Delivery orders. Delivery charges are shown clearly before you confirm your order.</p>"
    },
    {
        category: "Delivery & Shipping",
        question: "How long does delivery take?",
        answer: "<p>Orders inside Dhaka are usually delivered within 24-48 hours. Orders outside Dhaka take 2-4 business days depending on the courier service and your district.</p>"
    },

    // ---------- Warranty & After-Sales Support ----------
    {
        category: "Warranty & After-Sales Support",
        question: "Do your products come with a warranty?",
        answer: "<p>Yes. Almost all our products carry an official brand warranty — typically 3 years to lifetime depending on the product. Warranty details are listed on each product page and on our <a href=\"/warranty\">Warranty</a> page.</p>"
    },
    {
        category: "Warranty & After-Sales Support",
        question: "How do I claim warranty?",
        answer: "<p>Bring or courier the product to our showroom with your invoice or order number. Our service team will verify the issue and process a repair or replacement according to the brand's warranty policy.</p>"
    },

    // ---------- Authenticity & Support ----------
    {
        category: "Authenticity & Support",
        question: "Are all your products genuine?",
        answer: "<p>Absolutely. Mizan Trade is an authorized importer and distributor. Every product is sourced directly from manufacturers or their official regional distributors, and is covered by official brand warranty.</p>"
    },
    {
        category: "Authenticity & Support",
        question: "I have more questions. Who can I ask?",
        answer: "<p>Call our hotline, email support@mizantrade.com, or use the question form on any product page — our team replies to product questions regularly.</p>"
    }
];

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        let created = 0;
        let skipped = 0;

        for (let i = 0; i < FAQS.length; i++) {
            const item = FAQS[i];
            const exists = await Faq.findOne({
                category: item.category,
                question: item.question
            });

            if (exists) {
                skipped++;
                continue;
            }

            await Faq.create({
                category: item.category,
                question: item.question,
                answer: item.answer,
                order: i + 1,
                isActive: true
            });
            created++;
        }

        console.log(`Done. Created: ${created}, Skipped (already exists): ${skipped}.`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("FAQ seed error:", error);
        process.exit(1);
    }
}

run();
