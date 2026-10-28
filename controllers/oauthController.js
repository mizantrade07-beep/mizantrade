const crypto = require("crypto");

const config = require("../config/env");
const Customer = require("../models/Customer");
const oauth = require("../utils/oauth");
const { notifyCustomerLogin } = require("../utils/notify");
const {
    regenerateSession,
    saveSession,
    setCustomerSession
} = require("../utils/customerSession");

function callbackUrl(provider) {
    return oauth.redirectUri(config.siteUrl, provider);
}

function loginError(provider, message) {
    return "/login?message=" + message + "&provider=" + encodeURIComponent(provider);
}

exports.start = (req, res) => {
    const provider = String(req.params.provider || "").toLowerCase();

    if (!oauth.providers[provider]) {
        return res.redirect("/login");
    }

    if (!oauth.isConfigured(provider)) {
        return res.redirect(loginError(provider, "oauth_not_configured"));
    }

    const state = crypto.randomBytes(24).toString("hex");

    req.session.oauthState = {
        state,
        provider,
        createdAt: Date.now()
    };

    req.session.save((err) => {
        if (err) {
            console.error("OAuth state save failed:", err);
            return res.redirect(loginError(provider, "oauth_failed"));
        }

        return res.redirect(oauth.authUrl(provider, callbackUrl(provider), state));
    });
};

exports.callback = async (req, res) => {
    const provider = String(req.params.provider || "").toLowerCase();

    if (!oauth.providers[provider]) {
        return res.redirect("/login");
    }

    if (!oauth.isConfigured(provider)) {
        return res.redirect(loginError(provider, "oauth_not_configured"));
    }

    const expected = req.session.oauthState || null;
    req.session.oauthState = null;

    const state = String(req.query.state || "");
    const code = String(req.query.code || "");

    const stateValid = Boolean(
        expected &&
        expected.provider === provider &&
        expected.state === state &&
        Date.now() - expected.createdAt < 10 * 60 * 1000
    );

    if (req.query.error || !code || !stateValid) {
        await saveSession(req).catch(() => {});
        return res.redirect(
            loginError(provider, req.query.error ? "oauth_cancelled" : "oauth_failed")
        );
    }

    const profile = await oauth.exchangeCode(provider, code, callbackUrl(provider));

    if (!profile || !profile.providerId) {
        await saveSession(req).catch(() => {});
        return res.redirect(loginError(provider, "oauth_failed"));
    }

    try {
        const providerField = provider + "Id";
        let customer = await Customer.findOne({ [providerField]: profile.providerId });

        if (!customer && profile.email) {
            customer = await Customer.findOne({ email: profile.email });
        }

        if (customer && !customer.isActive) {
            return res.redirect(loginError(provider, "oauth_inactive"));
        }

        if (customer) {
            if (!customer[providerField]) {
                customer[providerField] = profile.providerId;
            }

            if (!customer.email && profile.email) {
                const taken = await Customer.exists({
                    email: profile.email,
                    _id: { $ne: customer._id }
                });

                if (!taken) customer.email = profile.email;
            }

            if (
                profile.emailVerified &&
                profile.email &&
                customer.email === profile.email
            ) {
                customer.emailVerified = true;
            }

            if (!customer.avatar && profile.avatar) {
                customer.avatar = profile.avatar;
            }

            await customer.save();
        } else {
            const doc = {
                name: profile.name || "Customer",
                authProvider: provider,
                avatar: profile.avatar || "",
                emailVerified: Boolean(profile.email && profile.emailVerified)
            };

            doc[providerField] = profile.providerId;

            if (profile.email) doc.email = profile.email;

            customer = await Customer.create(doc);
        }

        await regenerateSession(req);
        setCustomerSession(req, customer);
        await saveSession(req);

        customer.lastLoginAt = new Date();
        await customer.save();

        notifyCustomerLogin(customer, req);

        return res.redirect("/account");
    } catch (error) {
        console.error("OAuth account error:", error);
        return res.redirect(loginError(provider, "oauth_failed"));
    }
};
