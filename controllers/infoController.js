const Page = require("../models/Page");
const { buildSeo, stripHtml } = require("../utils/seo");

const infoPages = {
    about: {
        title: "About Us",
        content: `
            <h2>About The Proprietor</h2>
            <p><strong>Mr. Anisur Rahman: A Visionary Entrepreneur.</strong> Mr. Anisur Rahman is the founder and driving force behind Mizan Trade. It is his visionary leadership and business integrity that have brought the company to its current standing.</p>
            <p><strong>Business Philosophy.</strong> Mr. Anisur Rahman's business principles are built on three main pillars:</p>
            <ul>
                <li><strong>Honesty and Transparency:</strong> He always prioritizes maintaining transparency in transactions and product quality.</li>
                <li><strong>Customer Satisfaction:</strong> He believes that the long-term success of a business depends on the trust of its customers.</li>
                <li><strong>Quality Standards:</strong> His primary goal is to provide high-quality products at affordable prices.</li>
            </ul>
            <blockquote><p>"Success does not merely mean earning profit; rather, true achievement lies in earning the trust of customers." — Anisur Rahman</p></blockquote>
            <h2>About Mizan Trade</h2>
            <p>Mizan Trade is a well-established and trusted name in the IT sector of Bangladesh. Since its founding in 2008, we have been supplying world-class IT hardware and accessories with an excellent reputation. Our core mission is to make our customers' business and personal lives more dynamic through modern technology and innovative products.</p>
            <h2>Our Introduction</h2>
            <p>We primarily operate as an importer, wholesaler, and distributor of IT products. Over the past 17 years, we have built ourselves as a symbol of trust for numerous clients, including government organizations, corporate offices, banks, and educational institutions. We do not just supply products; we understand each customer's needs and provide the right technical solutions tailored to them.</p>
            <h2>Our Main Products</h2>
            <p>We directly supply IT solutions from world-renowned brands, including Computer &amp; Laptop Accessories: premium-quality high-speed SSDs and RAM for desktops and laptops with the latest configurations. Security Systems: CCTV cameras, access control systems, video intercoms, and alarm systems.</p>
            <h2>Why Choose Us?</h2>
            <ul>
                <li><strong>Experience:</strong> Our team includes professionals with 5 to over 10 years of experience in the IT sector.</li>
                <li><strong>Authorized Distributor:</strong> We are an authorized distributor of globally renowned brands such as KingSpec, AITC Kingsman Gaming, Unika, Xenthra, and PowerSync.</li>
                <li><strong>Extensive Network:</strong> We have a proven track record of successful projects with various government and private organizations.</li>
                <li><strong>Commitment to Trust:</strong> We don't just sell products; through reliable after-sales service, we ensure long-term customer satisfaction.</li>
            </ul>
            <h2>Customer Service</h2>
            <p>We have a strong marketing &amp; technical team for channel sales and corporate support. We supply all IT accessories — especially our distribution brands — and provide technical support to our customers. We sale and supply Laptop &amp; Desktop Accessories (SSD SATA, SSD NVMe M.2, RGB RAM, Heatsink &amp; Non-Heatsink RAM, CPU Cooler, etc.) and Security Systems (CC Camera, Access Control, Alarm System, Door Security System, Video Intercom, etc.), Printer, Toner, Cartridge, Laptop, Projector, UPS, Antivirus &amp; more. Customer satisfaction is our first priority.</p>
            <h2>Our Vision &amp; Mission</h2>
            <p>Our goal is to deliver genuine IT products to every corner of Bangladesh. We believe that proper technological support will further accelerate the country's digital transformation. Through a transparent and accountable business structure, we are committed to building long-term relationships with our customers.</p>
            <h2>Contact Information</h2>
            <p><strong>Head Office:</strong> House #30, 4th Floor (Lift), New Elephant Road, Suvastu Arcade Lane, Dhaka-1205, Bangladesh.</p>
            <p><strong>Showroom:</strong> Multiplan Center, Shop #301, 3rd Floor, Dhaka-1205, Bangladesh.</p>`
    },

    contact: {
        title: "Contact Us",
        content: `
            <p>Have questions or need assistance with our IT solutions? Get in touch with our expert team today. We are here to provide the support and guidance your business needs.</p>
            <p><strong>Direct Contact Number:</strong> <a href="tel:+8801709867815">+88 01709-867815</a></p>
            <p><strong>Electronic Mail:</strong> <a href="mailto:info@mizantrade.com">info@mizantrade.com</a></p>
            <p>For bulk corporate inquiries, customized IT partnerships, or to share any feedback and complaints, please reach out to our dedicated support managers. We value your business.</p>
            <p><strong>Administrative Business Hours:</strong></p>
            <ul>
                <li>Saturday through Thursday: 10AM – 08PM</li>
                <li>Tuesday: Closed</li>
            </ul>
            <p><strong>Showroom Display Hours:</strong></p>
            <ul>
                <li>Wednesday through Monday: 10AM – 08PM</li>
                <li>Tuesday: Closed</li>
            </ul>
            <p><strong>Retail Branch Location:</strong> Shop No 301-303, Level 3, 69-71 New Elephant Road, Dhaka.</p>
            <p><strong>Headquarters Location:</strong> 30 New Elephant Road, Level 4, Dhaka 1205.</p>`
    },

    "privacy-policy": {
        title: "Privacy Policy",
        content: `
            <p>Welcome to <strong>mizantrade.com</strong>. We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and protect your information when you visit or purchase from our website.</p>
            <h3>Information We Collect</h3>
            <p>We may collect the following information:</p>
            <ul>
                <li>Full name</li>
                <li>Phone number</li>
                <li>Email address</li>
                <li>Shipping and billing address</li>
                <li>Payment information</li>
                <li>Device and browser information</li>
                <li>Order history</li>
            </ul>
            <h3>How We Use Your Information</h3>
            <p>Your information may be used for:</p>
            <ul>
                <li>Processing orders</li>
                <li>Delivering products</li>
                <li>Customer support</li>
                <li>Improving website services</li>
                <li>Sending order updates and notifications</li>
                <li>Preventing fraud and ensuring security</li>
            </ul>
            <h3>Data Protection</h3>
            <p>We implement appropriate security measures to protect your personal information. However, no online system is completely secure.</p>
            <h3>Third-Party Services</h3>
            <p>We may share information with trusted third-party services such as payment gateways, delivery partners, and website analytics providers. These services are only allowed to use your information for the purpose of providing their services.</p>
            <h3>Cookies</h3>
            <p>Our website may use cookies to improve user experience and website functionality.</p>
            <h3>Changes to This Policy</h3>
            <p>We reserve the right to update this Privacy Policy at any time. Updates will be posted on this page.</p>
            <h3>Contact Information</h3>
            <p>Website: mizantrade.com &nbsp;|&nbsp; Phone: <a href="tel:+8801709867815">+88 01709-867815</a></p>`
    },

    terms: {
        title: "Terms and Conditions",
        content: `
            <h3>Acceptance of Terms</h3>
            <p>By accessing and using <strong>mizantrade.com</strong>, you agree to comply with these Terms and Conditions.</p>
            <h3>Product Information</h3>
            <p>We try to ensure that all product descriptions, prices, and images are accurate. However, errors may occur.</p>
            <h3>Pricing</h3>
            <p>Prices displayed on the website are subject to change without prior notice.</p>
            <h3>Orders</h3>
            <p>We reserve the right to cancel orders, limit quantities, or refuse service if suspicious activity is detected.</p>
            <h3>Payment</h3>
            <p>We accept various payment methods including:</p>
            <ul>
                <li>Cash on Delivery (COD)</li>
                <li>Mobile Banking (bKash / Nagad)</li>
                <li>Bank Transfer</li>
            </ul>
            <h3>Shipping</h3>
            <p>Delivery time depends on location and courier service availability. Typical delivery time:</p>
            <ul>
                <li>Inside Dhaka: 1-3 days</li>
                <li>Outside Dhaka: 2-5 days</li>
            </ul>
            <h3>Intellectual Property</h3>
            <p>All content on this website including text, images, logos, and graphics is the property of <strong>mizantrade.com</strong>.</p>
            <h3>Limitation of Liability</h3>
            <p>We are not responsible for delays caused by courier services, product misuse by customers, or external technical issues.</p>
            <h3>Policy Updates</h3>
            <p>We may modify these Terms and Conditions at any time.</p>`
    },

    "refund-policy": {
        title: "Refund and Return Policy",
        content: `
            <p>At <strong>mizantrade.com</strong>, we are committed to providing quality products and a reliable shopping experience. If you are not satisfied with your purchase, you may request a return, replacement, or refund according to the policy below.</p>
            <h3>Return Eligibility</h3>
            <p>A product can be returned or replaced under the following conditions:</p>
            <ul>
                <li>The product is <strong>damaged during delivery</strong></li>
                <li>The <strong>wrong product</strong> was delivered</li>
                <li>The product has a <strong>manufacturing defect</strong></li>
                <li>The product is <strong>missing accessories or parts</strong></li>
                <li>The product <strong>does not match the description</strong> on the website</li>
            </ul>
            <p>Return requests must be submitted <strong>within 3 days of receiving the product</strong>.</p>
            <h3>Conditions for Return</h3>
            <ul>
                <li>The product must be <strong>unused</strong></li>
                <li>The product must be returned in <strong>original packaging</strong></li>
                <li>All <strong>tags, manuals, and accessories</strong> must be included</li>
                <li><strong>Invoice or order ID</strong> must be provided</li>
            </ul>
            <h3>Non-Returnable Items</h3>
            <ul>
                <li>Used products</li>
                <li>Products damaged by the customer</li>
                <li>Products without original packaging</li>
                <li>Clearance or promotional items</li>
                <li>Digital products or software</li>
                <li>Products with removed or damaged <strong>warranty stickers</strong></li>
            </ul>
            <h3>Refund Process</h3>
            <p>After receiving the returned product, our team will inspect it. If the return is approved, the refund will be processed within <strong>3–7 business days</strong> through the <strong>original payment method</strong> (bKash, Nagad, Bank Transfer, or original method).</p>
            <h3>Replacement Policy</h3>
            <p>If a product has a <strong>manufacturing defect</strong>, customers may request a <strong>replacement instead of a refund</strong>. Replacement depends on <strong>stock availability</strong>; if the same product is unavailable, an <strong>equivalent product</strong> may be offered.</p>
            <h3>Shipping Costs</h3>
            <ul>
                <li><strong>Delivery charges are non-refundable</strong></li>
                <li>Customers may need to pay return shipping charges unless the product is <strong>defective or incorrect</strong></li>
            </ul>
            <h3>Order Cancellation</h3>
            <p>Orders may be cancelled <strong>before shipment only</strong>. Once the order has been shipped, cancellation will not be possible.</p>
            <h3>Warranty Related Issues</h3>
            <p>Products with manufacturer warranty must be claimed through the <strong>authorized service center</strong> according to the manufacturer's warranty policy.</p>
            <h3>Contact Information</h3>
            <p>Website: www.mizantrade.com &nbsp;|&nbsp; Email: <a href="mailto:support@mizantrade.com">support@mizantrade.com</a> &nbsp;|&nbsp; Phone: <a href="tel:+8801709867815">+88 01709-867815</a></p>`
    },

    warranty: {
        title: "Warranty Policy",
        content: `
            <h3>Warranty Coverage</h3>
            <p>Products sold on <strong>mizantrade.com</strong> may include manufacturer warranty depending on the brand and product category. The warranty generally covers <strong>manufacturing defects only</strong>. The warranty period may vary depending on the product type and will be mentioned on the <strong>product page or purchase invoice</strong>.</p>
            <h3>Warranty Claim Requirements</h3>
            <p>To claim warranty service, customers must provide:</p>
            <ul>
                <li>The <strong>original purchase invoice or receipt</strong></li>
                <li>The product with <strong>intact serial number or warranty sticker</strong></li>
                <li>The <strong>complete product</strong> in proper condition</li>
                <li>Original <strong>accessories or packaging</strong>, if required</li>
            </ul>
            <p>Failure to meet these conditions may result in rejection of the warranty claim.</p>
            <h3>Warranty Does Not Cover</h3>
            <ul>
                <li>Physical damage (broken, dropped, etc.)</li>
                <li>Damage caused by water or liquid</li>
                <li>Fire damage or electrical surge</li>
                <li>Rust, corrosion, or fungus</li>
                <li>Removed or damaged serial/warranty sticker</li>
                <li>Unauthorized repair or modification</li>
                <li>Improper use, misuse, or excessive load</li>
            </ul>
            <h3>Types of Warranty Service</h3>
            <p>Warranty service may be provided as product repair, replacement with the same product, or replacement with an equivalent product. The type of service depends on the <strong>manufacturer or supplier policy and product availability</strong>.</p>
            <h3>Warranty Processing Time</h3>
            <p>Warranty service processing may take approximately <strong>7–30 working days</strong>, depending on the manufacturer or authorized service center.</p>
            <h3>Sales Return Policy (According to BCS Practice)</h3>
            <p>At the retail level, the <strong>Sales Return Policy</strong> is considered an important matter. Due to product shortages in the market or other unavoidable circumstances, it may not always be possible for the seller to provide warranty service within the expected time. In such cases, or if warranty service is significantly delayed or cannot be provided for any valid reason, the seller may process a <strong>Sales Return</strong> based on the customer's request. For Sales Return, a <strong>depreciation rate of 25% per year</strong> will be deducted from the original purchase price of the product. After mutual discussion, the seller may refund the <strong>remaining value to the customer</strong> or provide <strong>another product of equivalent value</strong>.</p>
            <h3>Data Responsibility</h3>
            <p>For storage devices such as <strong>Hard Drives, SSDs, Memory Cards, or other storage media</strong>, customers are responsible for backing up their data before submitting the product for warranty service. <strong>mizantrade.com will not be responsible for any data loss</strong> during the warranty process.</p>
            <h3>Service Centers</h3>
            <p>Warranty services may be provided through authorized manufacturer service centers, distributor service centers, or supplier service departments.</p>
            <p><strong>Bangladesh Computer Samity (BCS)</strong> is the main organization representing computer and IT product businesses in Bangladesh. It has established a <strong>Warranty Policy</strong> for computer hardware and related products to protect the interests of both buyers and sellers.</p>
            <h3>Contact Information</h3>
            <p>Website: mizantrade.com &nbsp;|&nbsp; Phone: <a href="tel:+8801709867815">+88 01709-867815</a></p>`
    },

    "cookie-policy": {
        title: "Cookie Policy",
        content: `
            <p><strong>Mizan Trade</strong> uses cookies to improve your browsing experience and provide personalized services. Cookies are small text files stored on your device that help us analyze website traffic, remember your preferences, and enhance site functionality.</p>
            <p>By using our website, you consent to the use of cookies. You can choose to disable cookies through your browser settings, but some features of the site may not work properly.</p>
            <h3>Types of Cookies We Use</h3>
            <ul>
                <li><strong>Essential Cookies:</strong> Required for basic website functions.</li>
                <li><strong>Performance Cookies:</strong> Help us understand how visitors use the site.</li>
                <li><strong>Functional Cookies:</strong> Remember your preferences and settings.</li>
                <li><strong>Advertising Cookies:</strong> Used to deliver relevant ads and promotions.</li>
            </ul>
            <p>For more information, please contact us at <a href="mailto:support@mizantrade.com">support@mizantrade.com</a></p>`
    },

    services: {
        title: "Repair and Services",
        content: `
            <h3>Mizan Trade – Reliable Repair &amp; Technical Services</h3>
            <p>At <strong>Mizan Trade</strong>, we provide trusted <strong>repair and technical services</strong> for computers, IT devices, and security systems. Our experienced technicians quickly diagnose problems, use quality parts, and deliver effective solutions to ensure your devices perform at their best.</p>
            <h3>Our Services</h3>
            <h4>Computer Hardware Service</h4>
            <ul>
                <li>SSD / NVMe installation</li>
                <li>RAM upgrades</li>
                <li>CPU cooler and power supply setup</li>
            </ul>
            <h4>Printer &amp; Office Equipment Service</h4>
            <ul>
                <li>Printer repair and maintenance</li>
                <li>Office device setup and servicing</li>
            </ul>
            <h4>Security System Service</h4>
            <ul>
                <li>CCTV camera installation</li>
                <li>DVR / NVR configuration</li>
                <li>Access control systems</li>
                <li>Security system troubleshooting</li>
            </ul>
            <h4>IT Support &amp; Maintenance</h4>
            <ul>
                <li>Office and corporate IT support</li>
                <li>Network setup and maintenance</li>
                <li>Technical consultation</li>
            </ul>
            <h3>Why Choose Mizan Trade</h3>
            <ul>
                <li>Experienced and skilled technicians</li>
                <li>Fast and reliable service</li>
                <li>Genuine and high-quality parts</li>
                <li>Customer satisfaction is our top priority</li>
            </ul>
            <h3>Contact Us</h3>
            <p><strong>Mizan Trade</strong><br>House #30, Level #4 (Lift), Suvastu Arcade Lane, New Elephant Road, Dhaka-1205, Bangladesh.</p>
            <p>Phone: <a href="tel:+8801709867815">01709867815</a> &nbsp;|&nbsp; Email: <a href="mailto:mizantrade07@gmail.com">mizantrade07@gmail.com</a> &nbsp;|&nbsp; Website: mizantrade.com</p>`
    },

    "order-procedure": {
        title: "Order Procedure",
        content: `
            <p>At <strong>Mizan Trade</strong> we make ordering simple and hassle-free. Follow these steps to place your order:</p>
            <ol>
                <li><strong>Browse Products &amp; Services</strong> – Explore our catalog and select the items or services you need.</li>
                <li><strong>Add to Cart</strong> – Click "Add to Cart" for each product or service.</li>
                <li><strong>Review Your Order</strong> – Check quantities, prices, and total cost in your cart.</li>
                <li><strong>Login / Register</strong> – Sign in to your account or create a new one to proceed.</li>
                <li><strong>Provide Details</strong> – Enter your shipping address, contact info, and any special instructions.</li>
                <li><strong>Make Payment</strong> – Choose your preferred payment method and complete the payment securely.</li>
                <li><strong>Order Confirmation</strong> – Receive confirmation via email or SMS with your order details.</li>
                <li><strong>Track Your Order</strong> – Monitor the status of your order from your account dashboard.</li>
            </ol>`
    },

    "delivery-method": {
        title: "Delivery Method",
        content: `
            <h3>Delivery Service</h3>
            <p>mizantrade.com provides product delivery across Bangladesh through reliable courier services. All deliveries are completed through our authorized courier partners.</p>
            <h3>Delivery Time</h3>
            <p>After an order is confirmed, the product is usually delivered within the following timeframes:</p>
            <ul>
                <li><strong>Inside Dhaka city:</strong> 1–3 working days</li>
                <li><strong>Outside Dhaka:</strong> 2–5 working days</li>
            </ul>
            <p>Delivery may take additional time due to natural disasters, public holidays, or courier service issues.</p>
            <h3>Delivery Charges</h3>
            <p>Delivery charges are determined based on the delivery location. Generally:</p>
            <ul>
                <li><strong>Inside Dhaka city:</strong> BDT 80 – 120 tk.</li>
                <li><strong>Outside Dhaka:</strong> BDT 150 – 250 tk.</li>
            </ul>
            <p>The exact delivery charge will be shown during the order process.</p>
            <h3>Order Processing</h3>
            <p>After an order is confirmed, our team processes the order and hands it over to the courier service. Order processing is usually completed within <strong>24 hours</strong>.</p>
            <h3>Order Tracking</h3>
            <p>Once the product has been handed over to the courier service, customers may request order tracking information if needed.</p>
            <h3>Verification at Delivery</h3>
            <p>Customers are requested to check the following at the time of delivery: ensure the package is in proper condition, and confirm that the product matches the order. If any issue is found, please contact us immediately.</p>
            <h3>Failed Delivery</h3>
            <p>Delivery may fail due to incorrect delivery address, customer not reachable by phone, or customer unavailable to receive the product at the delivery time. In such cases, the order may be cancelled.</p>
            <h3>Contact Information</h3>
            <p>For any delivery-related support: mizantrade.com &nbsp;|&nbsp; Phone: <a href="tel:+8801709867815">+88 01709-867815</a></p>`
    },

    "our-brand": {
        title: "Our Brands",
        content: `
            <h3>Trusted Brands Available at Mizan Trade</h3>
            <p>We work with trusted and high-quality technology brands to provide reliable products to our customers. Our collection includes well-known brands from the IT and gaming industry that offer excellent performance, durability, and innovation.</p>
            <h3>1. AITC Kingsman Gaming</h3>
            <p><strong>Kingsman Gaming</strong> is a popular gaming brand that produces high-performance gaming hardware and accessories, designed to deliver speed, reliability, and enhanced performance for gamers and PC enthusiasts.</p>
            <p><strong>Products may include:</strong> Gaming RAM, Gaming SSD, Gaming Accessories, Performance PC Components.</p>
            <h3>2. KingSpec</h3>
            <p><strong>KingSpec</strong> is a globally recognized brand known for its high-quality storage solutions. Their SSD and memory products help improve computer speed and overall system performance.</p>
            <p><strong>Products may include:</strong> Desktop RAM, Gaming RAM, Gaming SSD, Industrial Storage Solutions, High-Performance Storage Devices.</p>
            <h3>3. Unika</h3>
            <p><strong>Unika</strong> is a reliable brand offering a variety of computer hardware and accessories, designed to provide stable performance for everyday computing and professional use.</p>
            <p><strong>Products may include:</strong> Computer Components, Storage Devices, PC Accessories.</p>
            <h3>4. Xenthra</h3>
            <p><strong>Xenthra</strong> provides modern IT hardware and technology products designed for efficiency, reliability, and long-term performance.</p>
            <p><strong>Products may include:</strong> Computer Accessories, Storage Devices, IT Hardware Solutions.</p>
            <h3>5. PowerSync</h3>
            <p><strong>PowerSync</strong> offers dependable power and connectivity solutions for computers and electronic devices.</p>
            <p><strong>Products may include:</strong> Desktop RAM, Gaming RAM, Gaming SSD, Industrial Storage Solutions, High-Performance Storage Devices, Power Supply Accessories, Computer Accessories.</p>
            <h3>Why Buy from Mizan Trade</h3>
            <ul>
                <li>Genuine and trusted brand products</li>
                <li>Competitive pricing</li>
                <li>Technical support and services</li>
                <li>Reliable IT solution provider</li>
            </ul>`
    },

    "payment-method": {
        title: "Payment Method",
        content: `
            <p>At Mizan Trade, we offer secure and convenient payment options for all your orders:</p>
            <p><strong>1. Mobile Banking:</strong></p>
            <ul>
                <li>bKash, Nagad, Rocket, and other popular mobile wallets</li>
                <li>Instant payment confirmation</li>
            </ul>
            <p><strong>2. Bank Transfer:</strong></p>
            <ul>
                <li>Direct transfer to our account</li>
                <li>Send payment proof via email or WhatsApp</li>
            </ul>
            <p><strong>3. Cash on Delivery (COD):</strong></p>
            <ul>
                <li>Pay when your order is delivered</li>
                <li>Available for selected products and locations</li>
            </ul>
            <p><strong>4. Online Payment Gateway:</strong></p>
            <ul>
                <li>Credit / Debit card payments via secure gateway</li>
                <li>Safe and fast transactions</li>
            </ul>
            <p><strong>Note:</strong> Please ensure you follow the correct payment instructions to avoid delays. For any payment-related queries, contact us at <a href="mailto:support@mizantrade.com">support@mizantrade.com</a> or call <a href="tel:+8801709867815">01709867815</a>.</p>`
    }
};

exports.getInfoPage = async (req, res) => {
    const slug = req.params.slug;

    try {
        // 1) If a published page exists in the database, display it (editable through the CMS)
        const dbPage = await Page.findOne({
            slug,
            status: "published"
        }).lean();

        if (dbPage) {
            res.locals.seo = buildSeo({
                title:
                    (dbPage.seo && dbPage.seo.metaTitle) ||
                    dbPage.title,

                description:
                    (dbPage.seo && dbPage.seo.metaDescription) ||
                    dbPage.excerpt ||
                    stripHtml(dbPage.content),

                keywords:
                    (dbPage.seo && dbPage.seo.keywords) || "",

                path: "/" + slug,

                image: dbPage.featuredImage || ""
            });

            return res.render("info", {
                pageTitle:
                    (dbPage.seo && dbPage.seo.metaTitle) ||
                    dbPage.title,

                page: dbPage,

                metaDescription:
                    (dbPage.seo && dbPage.seo.metaDescription) ||
                    dbPage.excerpt ||
                    "",

                metaKeywords:
                    (dbPage.seo && dbPage.seo.keywords) || ""
            });
        }

        // 2) If not found, use the built-in default content as a fallback
        const page = infoPages[slug];

        if (!page) {
            return res.status(404).render("errors/404", {
                pageTitle: "Not Found"
            });
        }

        res.locals.seo = buildSeo({
            title: page.title,
            description: stripHtml(page.content),
            path: "/" + slug
        });

        return res.render("info", {
            pageTitle: page.title + " - Mizan Trade",
            page,
            metaDescription: "",
            metaKeywords: ""
        });
    } catch (error) {
        console.error("Info page error:", error);
        return res.status(500).render("errors/500");
    }
};

/* Export default content for use by the seed script */
exports.defaults = infoPages;