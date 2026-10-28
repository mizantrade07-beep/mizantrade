const { getFooterContent, effectiveFooter } = require("../utils/footerContent");
const { getSettingsDoc } = require("../utils/siteSettings");
const { normPaymentAccounts, normPaymentIcons } = require("../utils/paymentForms");

/* ======================================================
   ADMIN — PAYMENT METHODS & ACCOUNTS
   (Moved out of Footer; storage stays in FooterContent so
   checkout and the public footer keep working unchanged.)
====================================================== */

exports.getPaymentMethods = async (req, res) => {
    try {
        const [content, settings] = await Promise.all([
            getFooterContent(),
            getSettingsDoc()
        ]);

        const plain = content.toObject();

        return res.render("admin/paymentMethods", {
            pageTitle: "Payment Methods",
            content: plain,
            settings,
            active: effectiveFooter(plain),
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getPaymentMethods error:", error.message);
        return res.redirect("/admin/dashboard");
    }
};

exports.postPaymentMethods = async (req, res) => {
    try {
        const body = req.body || {};
        const content = await getFooterContent();

        content.paymentAccounts = normPaymentAccounts(body.paymentAccounts);
        content.paymentIcons = normPaymentIcons(body.paymentIcons);

        await content.save();

        return res.redirect("/admin/payment-methods?message=saved");
    } catch (error) {
        console.error("postPaymentMethods error:", error.message);
        return res.redirect("/admin/payment-methods?message=error");
    }
};
