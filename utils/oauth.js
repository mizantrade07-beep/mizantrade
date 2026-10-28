/* ======================================================
   Social login (OAuth 2.0) — Google, Facebook, TikTok
   Credentials live in .env; nothing is hardcoded.
   Each exchange returns a normalised profile or null.
====================================================== */

const PROVIDERS = {
    google: {
        label: "Google",
        clientId: () => process.env.GOOGLE_CLIENT_ID,
        clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
        scope: "openid email profile"
    },
    facebook: {
        label: "Facebook",
        clientId: () => process.env.FACEBOOK_APP_ID,
        clientSecret: () => process.env.FACEBOOK_APP_SECRET,
        authorizeUrl: "https://www.facebook.com/v25.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v25.0/oauth/access_token",
        profileUrl: "https://graph.facebook.com/v25.0/me?fields=id,name,email,picture.type(large)",
        scope: "email,public_profile"
    },
    tiktok: {
        label: "TikTok",
        clientId: () => process.env.TIKTOK_CLIENT_KEY,
        clientSecret: () => process.env.TIKTOK_CLIENT_SECRET,
        authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
        tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
        profileUrl: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
        scope: "user.info.basic"
    }
};

function providerOf(name) {
    return PROVIDERS[String(name || "").toLowerCase()] || null;
}

function labelOf(name) {
    const provider = providerOf(name);
    return provider ? provider.label : "Social";
}

function isConfigured(name) {
    const provider = providerOf(name);
    if (!provider) return false;
    return Boolean(provider.clientId() && provider.clientSecret());
}

function trimSlash(url) {
    return String(url || "").replace(/\/+$/, "");
}

function redirectUri(baseUrl, name) {
    return trimSlash(baseUrl) + "/auth/" + name + "/callback";
}

function authUrl(name, callbackUrl, state) {
    const provider = providerOf(name);
    if (!provider) return "";

    const params = new URLSearchParams();
    params.set("client_id", provider.clientId());
    params.set("redirect_uri", callbackUrl);
    params.set("response_type", "code");
    params.set("state", state);

    if (name === "tiktok") {
        params.delete("client_id");
        params.set("client_key", provider.clientId());
    }

    const scope = name === "facebook" || name === "tiktok"
        ? provider.scope.replace(/\s+/g, ",")
        : provider.scope;

    params.set("scope", scope);

    if (name === "google") {
        params.set("prompt", "select_account");
        params.set("access_type", "online");
    }

    return provider.authorizeUrl + "?" + params.toString();
}

async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
        return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
        clearTimeout(timer);
    }
}

async function readJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (err) {
        return null;
    }
}

async function exchangeCode(name, code, callbackUrl) {
    const provider = providerOf(name);
    if (!provider) return null;

    try {
        let accessToken = "";
        let tokenBody = null;

        if (name === "google") {
            const body = new URLSearchParams({
                code,
                client_id: provider.clientId(),
                client_secret: provider.clientSecret(),
                redirect_uri: callbackUrl,
                grant_type: "authorization_code"
            });
            const res = await fetchWithTimeout(provider.tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body
            });
            tokenBody = await readJson(res);
            accessToken = tokenBody && tokenBody.access_token;
        }

        if (name === "facebook") {
            const url = provider.tokenUrl +
                "?client_id=" + encodeURIComponent(provider.clientId()) +
                "&client_secret=" + encodeURIComponent(provider.clientSecret()) +
                "&redirect_uri=" + encodeURIComponent(callbackUrl) +
                "&code=" + encodeURIComponent(code);
            const res = await fetchWithTimeout(url, { method: "GET" });
            tokenBody = await readJson(res);
            accessToken = tokenBody && tokenBody.access_token;
        }

        if (name === "tiktok") {
            const body = new URLSearchParams({
                client_key: provider.clientId(),
                client_secret: provider.clientSecret(),
                code,
                grant_type: "authorization_code",
                redirect_uri: callbackUrl
            });
            const res = await fetchWithTimeout(provider.tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body
            });
            tokenBody = await readJson(res);
            accessToken = tokenBody && tokenBody.access_token;
        }

        if (!accessToken) {
            console.error("OAuth " + name + " token exchange failed.");
            return null;
        }

        const profileRes = await fetchWithTimeout(provider.profileUrl, {
            method: "GET",
            headers: { Authorization: "Bearer " + accessToken }
        });
        const profileBody = await readJson(profileRes);

        if (!profileBody) {
            console.error("OAuth " + name + " profile request failed.");
            return null;
        }

        if (name === "google") {
            return {
                provider: name,
                providerId: String(profileBody.sub || ""),
                name: String(profileBody.name || "").trim(),
                email: String(profileBody.email || "").trim().toLowerCase(),
                avatar: String(profileBody.picture || ""),
                emailVerified: profileBody.email_verified === true
            };
        }

        if (name === "facebook") {
            return {
                provider: name,
                providerId: String(profileBody.id || ""),
                name: String(profileBody.name || "").trim(),
                email: String(profileBody.email || "").trim().toLowerCase(),
                avatar: profileBody.picture && profileBody.picture.data
                    ? String(profileBody.picture.data.url || "")
                    : "",
                emailVerified: true
            };
        }

        const user = profileBody.data && profileBody.data.user ? profileBody.data.user : {};
        return {
            provider: name,
            providerId: String(user.open_id || tokenBody.open_id || ""),
            name: String(user.display_name || "").trim(),
            email: "",
            avatar: String(user.avatar_url || ""),
            emailVerified: false
        };
    } catch (err) {
        console.error("OAuth " + name + " exchange error:", err.name === "AbortError" ? "timeout" : err.message);
        return null;
    }
}

function messageFor(query) {
    const code = String(query && query.message || "");
    const provider = String(query && query.provider || "");
    const label = providerOf(provider) ? labelOf(provider) : "Social";

    if (code === "oauth_not_configured") {
        return label + " sign-in will be available soon. Please use your e-mail and password.";
    }
    if (code === "oauth_cancelled") {
        return label + " sign-in was cancelled.";
    }
    if (code === "oauth_failed") {
        return "We couldn't complete " + label + " sign-in. Please try again.";
    }
    if (code === "oauth_inactive") {
        return "This account is inactive. Please contact support.";
    }

    return "";
}

module.exports = {
    providers: PROVIDERS,
    isConfigured,
    labelOf,
    redirectUri,
    authUrl,
    exchangeCode,
    messageFor
};
