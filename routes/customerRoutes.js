const express = require("express");

const router = express.Router();

const customerAuth = require("../controllers/customerAuthController");

const {
    requireCustomer,
    redirectIfCustomerAuthenticated
} = require("../middleware/auth");

/* ======================================================
   SIGNUP
====================================================== */

router.get("/signup", redirectIfCustomerAuthenticated, customerAuth.showSignup);
router.post("/signup", redirectIfCustomerAuthenticated, customerAuth.signup);

/* ======================================================
   LOGIN / LOGOUT
====================================================== */

router.get("/login", redirectIfCustomerAuthenticated, customerAuth.showLogin);
router.post("/login", redirectIfCustomerAuthenticated, customerAuth.login);
router.post("/logout", customerAuth.logout);

/* ======================================================
   ACCOUNT
====================================================== */

router.get("/account", requireCustomer, customerAuth.getAccount);
router.post("/account/update", requireCustomer, customerAuth.postUpdateProfile);

module.exports = router;
