const { getSettingsDoc, saveSettings } = require("../utils/siteSettings");

/* Number helper: empty string -> undefined so schema default is not clobbered
   with NaN; otherwise coerce to Number. */
function num(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return undefined;
    }
    const n = Number(value);
    return isNaN(n) ? undefined : n;
}

function str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

/* ======================================================
   ADMIN - SETTINGS PAGE (GET)
====================================================== */

exports.getSettingsPage = async (req, res) => {
    try {
        const settings = await getSettingsDoc();

        res.render("admin/settings", {
            settings,
            message: req.query.message || null
        });
    } catch (error) {
        console.error("getSettingsPage error:", error.message);
        res.redirect("/admin/dashboard");
    }
};

/* ======================================================
   ADMIN - UPDATE SETTINGS (POST)
====================================================== */

exports.postUpdateSettings = async (req, res) => {
    try {
        const body = req.body || {};

        const data = {
            siteName: str(body.siteName),
            hotline: str(body.hotline),
            email: str(body.email),
            address: str(body.address),

            shipping: {
                insideDhaka: num(body["shipping.insideDhaka"]),
                outsideDhaka: num(body["shipping.outsideDhaka"])
            },

            bkash: {
                number: str(body["bkash.number"]),
                type: str(body["bkash.type"]),
                chargePercent: num(body["bkash.chargePercent"])
            },

            bank: {
                bankName: str(body["bank.bankName"]),
                branch: str(body["bank.branch"]),
                accountName: str(body["bank.accountName"]),
                accountNumber: str(body["bank.accountNumber"]),
                routingNumber: str(body["bank.routingNumber"])
            },

            social: {
                facebook: str(body["social.facebook"]),
                instagram: str(body["social.instagram"]),
                youtube: str(body["social.youtube"]),
                whatsapp: str(body["social.whatsapp"]),
                linkedin: str(body["social.linkedin"])
            },

            footerText: str(body.footerText),
            metaTitle: str(body.metaTitle),
            metaDescription: str(body.metaDescription)
        };

        /* Object.assign with nested objects would replace them wholesale;
           drop undefined nested numbers so existing values survive. */
        ["shipping", "bkash", "bank", "social"].forEach(function (group) {
            Object.keys(data[group]).forEach(function (k) {
                if (data[group][k] === undefined) delete data[group][k];
            });
        });

        await saveSettings(data);

        res.redirect("/admin/settings?message=saved");
    } catch (error) {
        console.error("postUpdateSettings error:", error.message);
        res.redirect("/admin/settings?message=error");
    }
};
