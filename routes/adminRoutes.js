const express = require("express");

const router = express.Router();

const adminController = require("../controllers/adminController");
const productController = require("../controllers/productController");
const categoryController = require("../controllers/categoryController");
const orderController = require("../controllers/orderController");
const partnerController = require("../controllers/partnerController");
const staffController = require("../controllers/staffController");
const customerController = require("../controllers/customerController");
const pageController = require("../controllers/pageController");
const postController = require("../controllers/postController");
const commentController = require("../controllers/commentController");
const couponController = require("../controllers/couponController");
const reviewController = require("../controllers/reviewController");
const analyticsController = require("../controllers/analyticsController");
const settingController = require("../controllers/settingController");
const seoMarketingController = require("../controllers/seoMarketingController");
const topHeaderController = require("../controllers/topHeaderController");
const attributeController = require("../controllers/attributeController");
const homepageController = require("../controllers/homepageController");
const footerController = require("../controllers/footerController");
const paymentMethodController = require("../controllers/paymentMethodController");
const faqController = require("../controllers/faqController");
const offerController = require("../controllers/offerController");
const chatController = require("../controllers/chatController");
const teamController = require("../controllers/teamController");
const rewardController = require("../controllers/rewardController");

const upload = require("../middleware/upload");

const { requireAdmin } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");


/* ======================================================
   ADMIN PROTECTION
====================================================== */

router.use(requireAdmin);


/* ======================================================
   DASHBOARD
====================================================== */

router.get("/dashboard", adminController.getDashboard);


/* ======================================================
   ANALYTICS
====================================================== */

router.get(
    "/analytics",
    requirePermission("analytics.view"),
    analyticsController.getAnalytics
);


/* ======================================================
   PRODUCTS
====================================================== */

router.get("/products", productController.getAdminProducts);

router.post(
    "/products/bulk",
    productController.bulkUpdateProducts
);

router.get("/products/add", productController.getAddProductPage);

router.post(
    "/product/add",
    upload.fields([
        { name: "mainImage", maxCount: 1 },
        { name: "galleryImages", maxCount: 10 }
    ]),
    productController.postAddProduct
);

router.get("/product/edit/:id", productController.getEditProductPage);

router.post(
    "/product/edit/:id",
    upload.fields([
        { name: "mainImage", maxCount: 1 },
        { name: "galleryImages", maxCount: 10 }
    ]),
    productController.postEditProduct
);

router.get("/product/delete/:id", productController.deleteProduct);

router.get("/product/duplicate/:id", productController.duplicateProduct);

router.get("/questions", productController.getAdminQuestions);

router.post(
    "/questions/:productId/:questionId/answer",
    productController.postAnswerQuestion
);

router.get(
    "/questions/:productId/:questionId/approve",
    productController.getToggleQuestionApproval
);

router.get(
    "/questions/:productId/:questionId/delete",
    productController.getDeleteQuestion
);

router.post(
    "/upload-image",
    upload.single("image"),
    productController.postUploadImage
);

router.post(
    "/upload-media",
    upload.media.single("media"),
    productController.postUploadMedia
);


/* ======================================================
   CATEGORIES
====================================================== */

router.get("/categories", categoryController.getCategories);

router.get("/categories/add", categoryController.getAddCategoryPage);

router.post("/categories/add", categoryController.postAddCategory);

router.get("/categories/edit/:id", categoryController.getEditCategoryPage);

router.post("/categories/edit/:id", categoryController.postEditCategory);

router.get("/categories/delete/:id", categoryController.deleteCategory);


/* ======================================================
   FILTER ATTRIBUTES (SPEC REGISTRY)
====================================================== */

router.get("/attributes", attributeController.getAttributes);

router.post("/attributes", attributeController.postSaveAttribute);

router.get("/attributes/delete/:id", attributeController.deleteAttribute);


/* ======================================================
   ORDERS
====================================================== */

router.get("/orders", orderController.getOrders);

router.get("/order-history", requirePermission("orders.view"), orderController.getOrderHistory);

router.get("/payment-history", requirePermission("analytics.view"), orderController.getPaymentHistory);

router.get("/order/:id", orderController.getOrderDetail);

router.get("/order/:id/print/:doc", orderController.getPrintDocument);

router.post("/order/:id/status", orderController.postUpdateOrderStatus);

router.get("/order/delete/:id", orderController.deleteOrder);


/* ======================================================
   PARTNERS
====================================================== */

router.get("/partners", adminController.getPartnerRequests);

router.get("/partners/:id", partnerController.getPartnerDetail);

router.post("/partners/:id/status", partnerController.postUpdatePartnerStatus);

router.post("/partners/:id/create-login", partnerController.createPartnerLogin);
router.post("/partners/:id/toggle-login", partnerController.togglePartnerLoginStatus);
router.post("/partners/:id/reset-password", partnerController.resetPartnerPassword);

router.get("/partners/delete/:id", partnerController.deletePartner);

router.get("/partners/document/:filename", partnerController.getPartnerDocument);


/* ======================================================
   CUSTOMERS
====================================================== */

router.get(
    "/customers",
    requirePermission("customers.view"),
    customerController.getCustomers
);

router.get(
    "/customers/:id",
    requirePermission("customers.view"),
    customerController.getCustomerDetail
);

router.post(
    "/customers/:id/toggle",
    requirePermission("customers.manage"),
    customerController.toggleCustomerStatus
);

router.post(
    "/customers/:id/membership",
    requirePermission("customers.manage"),
    customerController.postUpdateMembership
);

router.post(
    "/customers/:id/reset-password",
    requirePermission("customers.manage"),
    customerController.resetCustomerPassword
);

router.get(
    "/customers/delete/:id",
    requirePermission("customers.manage"),
    customerController.deleteCustomer
);


/* ======================================================
   STAFF / ADMIN USERS (শুধু Admin)
====================================================== */

router.get(
    "/staff",
    requirePermission("staff.manage"),
    staffController.getStaff
);

router.get(
    "/staff/add",
    requirePermission("staff.manage"),
    staffController.getAddStaffPage
);

router.post(
    "/staff/add",
    requirePermission("staff.manage"),
    staffController.postAddStaff
);

router.get(
    "/staff/edit/:id",
    requirePermission("staff.manage"),
    staffController.getEditStaffPage
);

router.post(
    "/staff/edit/:id",
    requirePermission("staff.manage"),
    staffController.postEditStaff
);

router.get(
    "/staff/delete/:id",
    requirePermission("staff.manage"),
    staffController.deleteStaff
);


/* ======================================================
   PAGES (CMS)
====================================================== */

router.get(
    "/pages",
    requirePermission("content.edit"),
    pageController.getPages
);

router.get(
    "/pages/add",
    requirePermission("content.create"),
    pageController.getAddPagePage
);

router.post(
    "/pages/add",
    requirePermission("content.create"),
    upload.single("featuredImage"),
    pageController.postAddPage
);

router.get(
    "/pages/edit/:id",
    requirePermission("content.edit"),
    pageController.getEditPagePage
);

router.post(
    "/pages/edit/:id",
    requirePermission("content.edit"),
    upload.single("featuredImage"),
    pageController.postEditPage
);

router.get(
    "/pages/delete/:id",
    requirePermission("content.delete"),
    pageController.deletePage
);


/* ======================================================
   FAQ MANAGER
====================================================== */

router.get(
    "/faqs",
    requirePermission("content.edit"),
    faqController.getFaqs
);

router.get(
    "/faqs/add",
    requirePermission("content.create"),
    faqController.getAddFaqPage
);

router.post(
    "/faqs/add",
    requirePermission("content.create"),
    faqController.postAddFaq
);

router.get(
    "/faqs/edit/:id",
    requirePermission("content.edit"),
    faqController.getEditFaqPage
);

router.post(
    "/faqs/edit/:id",
    requirePermission("content.edit"),
    faqController.postEditFaq
);

router.get(
    "/faqs/delete/:id",
    requirePermission("content.delete"),
    faqController.deleteFaq
);


/* ======================================================
   OFFERS MANAGER
====================================================== */

router.get(
    "/offers",
    requirePermission("content.edit"),
    offerController.getOffers
);

router.get(
    "/offers/add",
    requirePermission("content.create"),
    offerController.getAddOfferPage
);

router.post(
    "/offers/add",
    requirePermission("content.create"),
    offerController.postAddOffer
);

router.get(
    "/offers/edit/:id",
    requirePermission("content.edit"),
    offerController.getEditOfferPage
);

router.post(
    "/offers/edit/:id",
    requirePermission("content.edit"),
    offerController.postEditOffer
);

router.get(
    "/offers/toggle/:id",
    requirePermission("content.edit"),
    offerController.toggleOffer
);

router.get(
    "/offers/delete/:id",
    requirePermission("content.delete"),
    offerController.deleteOffer
);

router.post(
    "/offers/import",
    requirePermission("content.edit"),
    function (req, res, next) {
        upload.importFile.single("file")(req, res, function (error) {
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message || "File upload failed."
                });
            }
            next();
        });
    },
    offerController.postImportFile
);


/* ======================================================
   LIVE CHATS
====================================================== */

router.get(
    "/chats",
    requirePermission("orders.view"),
    chatController.getChats
);

router.get(
    "/chats/:id",
    requirePermission("orders.view"),
    chatController.getChatDetail
);

router.get(
    "/chats/:id/messages",
    requirePermission("orders.view"),
    chatController.getChatMessagesJson
);

router.post(
    "/chats/:id/reply",
    requirePermission("orders.manage"),
    chatController.postAdminReply
);

router.post(
    "/chats/:id/bot-mode",
    requirePermission("orders.manage"),
    chatController.toggleBotMode
);

router.post(
    "/chats/:id/delete",
    requirePermission("orders.manage"),
    chatController.deleteChat
);


/* ======================================================
   POSTS (BLOG)
====================================================== */

router.get(
    "/posts",
    requirePermission("content.edit"),
    postController.getPosts
);

router.get(
    "/posts/add",
    requirePermission("content.create"),
    postController.getAddPostPage
);

router.post(
    "/posts/add",
    requirePermission("content.create"),
    upload.single("coverImage"),
    postController.postAddPost
);

router.get(
    "/posts/edit/:id",
    requirePermission("content.edit"),
    postController.getEditPostPage
);

router.post(
    "/posts/edit/:id",
    requirePermission("content.edit"),
    upload.single("coverImage"),
    postController.postEditPost
);

router.get(
    "/posts/delete/:id",
    requirePermission("content.delete"),
    postController.deletePost
);


/* ======================================================
   COMMENTS (MODERATION)
====================================================== */

router.get(
    "/comments",
    requirePermission("moderate"),
    commentController.getComments
);

router.get(
    "/comments/approve/:id",
    requirePermission("moderate"),
    commentController.approveComment
);

router.get(
    "/comments/delete/:id",
    requirePermission("moderate"),
    commentController.deleteComment
);


/* ======================================================
   COUPONS
====================================================== */

router.get(
    "/coupons",
    requirePermission("coupons.manage"),
    couponController.getAdminCoupons
);

router.get(
    "/coupons/add",
    requirePermission("coupons.manage"),
    couponController.getAddCouponPage
);

router.post(
    "/coupons/add",
    requirePermission("coupons.manage"),
    couponController.postAddCoupon
);

router.get(
    "/coupons/edit/:id",
    requirePermission("coupons.manage"),
    couponController.getEditCouponPage
);

router.post(
    "/coupons/edit/:id",
    requirePermission("coupons.manage"),
    couponController.postEditCoupon
);

router.post(
    "/coupons/toggle/:id",
    requirePermission("coupons.manage"),
    couponController.toggleCouponStatus
);

router.get(
    "/coupons/delete/:id",
    requirePermission("coupons.manage"),
    couponController.deleteCoupon
);


/* ======================================================
   PRODUCT REVIEWS (MODERATION)
====================================================== */

router.get(
    "/reviews",
    requirePermission("moderate"),
    reviewController.getReviews
);

router.post(
    "/reviews/approve/:productId/:reviewId",
    requirePermission("moderate"),
    reviewController.approveReview
);

router.post(
    "/reviews/update/:productId/:reviewId",
    requirePermission("moderate"),
    reviewController.updateReview
);

router.post(
    "/reviews/delete/:productId/:reviewId",
    requirePermission("moderate"),
    reviewController.deleteReview
);


/* ======================================================
   REWARD POINTS
====================================================== */

router.get(
    "/rewards",
    requirePermission("analytics.view"),
    rewardController.getRewards
);

router.post(
    "/rewards",
    requirePermission("settings.manage"),
    rewardController.postRewards
);


/* ======================================================
   HOMEPAGE CONTENT (hero slides, logos, latest count)
====================================================== */

router.get(
    "/homepage",
    requirePermission("content.edit"),
    homepageController.getHomepage
);

router.post(
    "/homepage",
    requirePermission("content.edit"),
    homepageController.postUpdateHomepage
);


/* ======================================================
   FOOTER CONTENT
====================================================== */

router.get(
    "/footer",
    requirePermission("settings.manage"),
    footerController.getFooter
);

router.post(
    "/footer",
    requirePermission("settings.manage"),
    footerController.postFooter
);

/* ------------------------------------------------------
   PAYMENT METHODS & ACCOUNTS
------------------------------------------------------ */

router.get(
    "/payment-methods",
    requirePermission("settings.manage"),
    paymentMethodController.getPaymentMethods
);

router.post(
    "/payment-methods",
    requirePermission("settings.manage"),
    paymentMethodController.postPaymentMethods
);


/* ======================================================
   SITE SETTINGS
====================================================== */

router.get(
    "/settings",
    requirePermission("settings.manage"),
    settingController.getSettingsPage
);

router.post(
    "/settings",
    requirePermission("settings.manage"),
    settingController.postUpdateSettings
);


/* ======================================================
   SEO & MARKETING
====================================================== */

router.get(
    "/seo",
    requirePermission("settings.manage"),
    seoMarketingController.getSeoPage
);

router.post(
    "/seo",
    requirePermission("settings.manage"),
    seoMarketingController.postSeoPage
);


/* ======================================================
   TOP HEADER PANEL
====================================================== */

router.get(
    "/top-header",
    requirePermission("settings.manage"),
    topHeaderController.getTopHeader
);

router.post(
    "/top-header",
    requirePermission("settings.manage"),
    topHeaderController.postTopHeader
);


/* ======================================================
   TEAM PAGE MEMBERS
====================================================== */

router.get(
    "/team",
    requirePermission("content.edit"),
    teamController.getTeamMembers
);

router.get(
    "/team/add",
    requirePermission("content.create"),
    teamController.getAddTeamMemberPage
);

router.post(
    "/team/add",
    requirePermission("content.create"),
    upload.team.single("photo"),
    teamController.postAddTeamMember,
    teamController.handlePhotoUploadError
);

router.get(
    "/team/edit/:id",
    requirePermission("content.edit"),
    teamController.getEditTeamMemberPage
);

router.post(
    "/team/edit/:id",
    requirePermission("content.edit"),
    upload.team.single("photo"),
    teamController.postEditTeamMember,
    teamController.handlePhotoUploadError
);

router.get(
    "/team/delete/:id",
    requirePermission("content.delete"),
    teamController.deleteTeamMember
);


module.exports = router;
