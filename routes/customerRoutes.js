const express = require("express");

const router = express.Router();

const customerAuth = require("../controllers/customerAuthController");
const oauthController = require("../controllers/oauthController");

const {
    requireCustomer,
    redirectIfCustomerAuthenticated
} = require("../middleware/auth");

/* ======================================================
   SIGNUP
====================================================== */

router.get("/signup", redirectIfCustomerAuthenticated, customerAuth.showSignup);
router.post("/signup", redirectIfCustomerAuthenticated, customerAuth.signup);
router.get("/signup/verify", redirectIfCustomerAuthenticated, customerAuth.showSignupVerify);
router.post("/signup/verify", redirectIfCustomerAuthenticated, customerAuth.verifySignupOtp);
router.post("/signup/resend", redirectIfCustomerAuthenticated, customerAuth.resendSignupOtp);
router.post("/signup/cancel", redirectIfCustomerAuthenticated, customerAuth.cancelSignup);

/* ======================================================
   LOGIN / LOGOUT
====================================================== */

router.get("/login", redirectIfCustomerAuthenticated, customerAuth.showLogin);
router.post("/login", redirectIfCustomerAuthenticated, customerAuth.login);
router.post("/logout", customerAuth.logout);

/* ======================================================
   SOCIAL LOGIN (Google / Facebook / TikTok)
====================================================== */

router.get("/auth/:provider", oauthController.start);
router.get("/auth/:provider/callback", oauthController.callback);

/* ======================================================
   FORGOT PASSWORD (security question)
====================================================== */

router.get("/forgot-password", customerAuth.showForgot);
router.post("/forgot-password", customerAuth.forgotLookup);
router.post("/forgot-password/reset", customerAuth.forgotReset);

/* ======================================================
   ACCOUNT
====================================================== */

router.get("/account", requireCustomer, customerAuth.getAccount);
router.get("/account/settings", requireCustomer, customerAuth.getAccountSettings);
router.post("/account/update", requireCustomer, customerAuth.postUpdateProfile);

module.exports = router;
