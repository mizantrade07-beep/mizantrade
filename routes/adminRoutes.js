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
   ORDERS
====================================================== */

router.get("/orders", orderController.getOrders);

router.get("/order/:id", orderController.getOrderDetail);

router.post("/order/:id/status", orderController.postUpdateOrderStatus);

router.get("/order/delete/:id", orderController.deleteOrder);


/* ======================================================
   PARTNERS
====================================================== */

router.get("/partners", adminController.getPartnerRequests);

router.get("/partners/:id", partnerController.getPartnerDetail);

router.post("/partners/:id/status", partnerController.postUpdatePartnerStatus);

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


module.exports = router;
