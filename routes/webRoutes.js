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
const upload = require('../middleware/upload');

// ০. SEO — sitemap ও robots
router.get('/sitemap.xml', seoController.getSitemap);
router.get('/robots.txt', seoController.getRobots);

// ১. হোমপেজ
router.get('/', storefrontController.getHome);

// ২. শপ ও ক্যাটাগরি পেজ
router.get('/shop', storefrontController.getShop);
router.get('/category/:slug', storefrontController.getCategoryPage);

// ৩. সিঙ্গেল প্রোডাক্ট + রিভিউ + প্রশ্ন
router.get('/product/:slug', productController.getSingleProduct);
router.post('/product/review/:id', productController.postProductReview);
router.post('/product/question/:id', productController.postProductQuestion);

// ৪. কার্ট
router.get('/cart', cartController.getCart);
router.post('/cart/add/:id?', cartController.addToCart);
router.post('/cart/update', cartController.updateCart);
router.post('/cart/remove/:id?', cartController.removeFromCart);
router.post('/cart/clear', cartController.clearCart);

// ৫. উইশলিস্ট
router.get('/wishlist', cartController.getWishlist);
router.get('/wishlist/add/:id', cartController.addToWishlist);
router.post('/wishlist/add/:id?', cartController.addToWishlist);
router.post('/wishlist/remove/:id', cartController.removeFromWishlist);

// ৬. চেকআউট ও অর্ডার
router.get('/checkout', checkoutController.getCheckout);
router.post('/checkout', checkoutController.postCheckout);
router.post('/checkout/apply-coupon', couponController.applyCoupon);
router.post('/checkout/remove-coupon', couponController.removeCoupon);
router.get('/order/success/:orderNumber', checkoutController.getOrderSuccess);

// ৭. কার্ট/উইশলিস্ট কাউন্ট API
router.get('/api/user-counts', cartController.getUserCounts);

// ৮. পার্টনার পেজ রুটস
router.get('/become-a-partner', partnerController.getPartnerForm);
router.post(
    '/become-a-partner',
    upload.partnerDocs.array('documents', 5),
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

// কাস্টমার অ্যাকাউন্ট (signup/login/account) রুটগুলো
// server.js-এ আলাদা customerRoutes-এ হ্যান্ডেল হয়।

module.exports = router;
