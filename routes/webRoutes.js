const express = require('express');
const router = express.Router();

const storefrontController = require('../controllers/storefrontController');
const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const checkoutController = require('../controllers/checkoutController');
const partnerController = require('../controllers/partnerController');
const pageController = require('../controllers/pageController');
const postController = require('../controllers/postController');
const commentController = require('../controllers/commentController');
const couponController = require('../controllers/couponController');
const seoController = require('../controllers/seoController');
const chatController = require('../controllers/chatController');
const faqController = require('../controllers/faqController');
const orderController = require('../controllers/orderController');
const compareController = require('../controllers/compareController');
const teamController = require('../controllers/teamController');
const upload = require('../middleware/upload');
const { requireCustomer, requirePartner, redirectIfPartnerAuthenticated } = require('../middleware/auth');

// ০. SEO — sitemap ও robots
router.get('/sitemap.xml', seoController.getSitemap);
router.get('/robots.txt', seoController.getRobots);

// ১. হোমপেজ
router.get('/', storefrontController.getHome);

// ২. শপ ও ক্যাটাগরি পেজ
router.get('/shop', storefrontController.getShop);
// Offers portal — admin-approved partners only; regular customers cannot enter.
router.get('/offers', requirePartner, storefrontController.getOffers);
router.get('/offers/:id', requirePartner, storefrontController.getOfferDetail);
// Team page (public) — linked beside the offers portal.
router.get('/team', teamController.getTeamPage);
// Partner login (separate realm from customer login).
router.get('/partner/login', redirectIfPartnerAuthenticated, partnerController.showPartnerLogin);
router.post('/partner/login', redirectIfPartnerAuthenticated, partnerController.partnerLogin);
router.post('/partner/logout', partnerController.partnerLogout);
router.get('/category/:slug', storefrontController.getCategoryPage);

// ৩. সিঙ্গেল প্রোডাক্ট + রিভিউ + প্রশ্ন
router.get('/product/:slug', productController.getSingleProduct);
router.post('/product/review/:id', productController.postProductReview);
router.post('/product/question/:id', productController.postProductQuestion);

// ৪. কার্ট
router.get('/cart', cartController.getCart);
router.post('/cart/add/:id?', cartController.addToCart);
router.post('/cart/buy-now/:id?', cartController.buyNow);
router.post('/cart/update', cartController.updateCart);
router.post('/cart/remove/:id?', cartController.removeFromCart);
router.post('/cart/clear', cartController.clearCart);

// ৫. উইশলিস্ট
router.get('/wishlist', cartController.getWishlist);
router.get('/wishlist/add/:id', cartController.addToWishlist);
router.post('/wishlist/add/:id?', cartController.addToWishlist);
router.post('/wishlist/remove/:id', cartController.removeFromWishlist);

// ৬. কম্পেয়ার (সর্বোচ্চ ৪টি প্রোডাক্ট পাশাপাশি)
router.get('/compare', compareController.getCompare);
router.get('/compare/add/:id', compareController.addToCompare);
router.post('/compare/add/:id?', compareController.addToCompare);
router.post('/compare/remove/:id', compareController.removeFromCompare);
router.post('/compare/clear', compareController.clearCompare);

// ৭. চেকআউট ও অর্ডার — অর্ডার করতে লগইন বাধ্যতামূলক
router.get('/checkout', requireCustomer, checkoutController.getCheckout);
router.post('/checkout', requireCustomer, checkoutController.postCheckout);
router.post('/checkout/otp/send', requireCustomer, checkoutController.sendCheckoutOtp);
router.post('/checkout/otp/verify', requireCustomer, checkoutController.verifyCheckoutOtp);
router.post('/checkout/apply-coupon', requireCustomer, couponController.applyCoupon);
router.post('/checkout/remove-coupon', requireCustomer, couponController.removeCoupon);
router.get('/order/success/:orderNumber', checkoutController.getOrderSuccess);

// ৭. কার্ট/উইশলিস্ট কাউন্ট API
router.get('/api/user-counts', cartController.getUserCounts);

// ৭.২ চ্যাটবট API
router.post('/chat/message', chatController.postMessage);
router.get('/chat/messages', chatController.getMessages);

// ৭.১ লাইভ সার্চ সাজেশন API
router.get('/api/search', storefrontController.searchSuggestions);

// ৮. পার্টনার পেজ রুটস
router.get('/become-a-partner', partnerController.getPartnerForm);
router.post(
    '/become-a-partner',
    function (req, res, next) {
        upload.partnerDocs.fields(partnerController.DOCUMENT_FIELDS)(req, res, function (err) {
            if (!err) return next();

            console.error("Partner document upload error:", err.message);

            partnerController.cleanupPartnerUploads(req);

            let message = err.message || "Upload failed. Please try again.";
            if (err.code === "LIMIT_FILE_SIZE") {
                message = "Each file must be 10MB or smaller.";
            } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
                message = "Too many files for one document type.";
            }

            return partnerController.renderPartnerForm(res, 400, {
                errorMessage: message,
                form: req.body || {}
            });
        });
    },
    partnerController.postPartnerForm
);

// ৯. ইনফরমেশন পেজ রুটস
router.get('/pages/payment-methods', (req, res) => {
    res.render('payment', { pageTitle: 'Payment Methods' });
});

router.get('/pages/shipping-info', (req, res) => {
    res.render('shipping', { pageTitle: 'Shipping Information' });
});

const infoController = require('../controllers/infoController');

const infoPagePaths = [
    'about',
    'contact',
    'privacy-policy',
    'terms',
    'refund-policy',
    'warranty',
    'cookie-policy',
    'services',
    'order-procedure',
    'delivery-method',
    'payment-method',
    'our-brand'
];

infoPagePaths.forEach((path) => {
    router.get('/' + path, (req, res, next) => {
        req.params.slug = path;
        infoController.getInfoPage(req, res, next);
    });
});

// ১০. ব্লগ (Post CMS)
router.get('/blog', postController.getBlog);
router.post('/blog/:slug/comment', commentController.postPublicComment);
router.get('/blog/:slug', postController.getPost);

// ১১. কাস্টম পেজ (Page CMS) — /page/:slug
router.get('/page/:slug', pageController.getPublicPage);

// ১২. FAQ ও অর্ডার ট্র্যাকিং
router.get('/faq', faqController.getPublicFaq);
router.get('/order-tracking', orderController.getOrderTracking);
router.post('/order-tracking', orderController.postOrderTracking);

// কাস্টমার অ্যাকাউন্ট (signup/login/account) রুটগুলো
// server.js-এ আলাদা customerRoutes-এ হ্যান্ডেল হয়।

module.exports = router;
