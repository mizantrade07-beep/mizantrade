/* ======================================================
   SOCIAL PLATFORM HELPERS (team profiles)
====================================================== */

const PLATFORMS = [
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "tiktok", label: "TikTok" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "youtube", label: "YouTube" },
    { key: "twitter", label: "X (Twitter)" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "telegram", label: "Telegram" },
    { key: "snapchat", label: "Snapchat" },
    { key: "discord", label: "Discord" },
    { key: "threads", label: "Threads" },
    { key: "pinterest", label: "Pinterest" },
    { key: "reddit", label: "Reddit" },
    { key: "website", label: "Website" }
];

const PLATFORM_KEYS = PLATFORMS.map(function (p) {
    return p.key;
});

function clean(value) {
    return String(value == null ? "" : value).trim();
}

function platformList() {
    return PLATFORMS.map(function (p) {
        return { key: p.key, label: p.label };
    });
}

function isKnownPlatform(key) {
    return PLATFORM_KEYS.indexOf(clean(key).toLowerCase()) !== -1;
}

/* Blocks javascript:, data:, vbscript: ... — only http(s) survives. */
function httpUrl(value) {
    const raw = clean(value);
    if (!raw) return "";

    if (raw.indexOf("//") === 0) {
        return safeUrl("https:" + raw);
    }

    if (/^https?:\/\//i.test(raw)) {
        return safeUrl(raw);
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";

    return safeUrl("https://" + raw.replace(/^\/+/, ""));
}

function safeUrl(value) {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
        return parsed.href;
    } catch (error) {
        return "";
    }
}

function handlePath(value) {
    return clean(value)
        .replace(/^@+/, "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .replace(/\s+/g, "");
}

function handleUrl(value, base, prefix) {
    const path = handlePath(value);
    if (!path) return "";
    return base + (prefix || "") + path;
}

function whatsappUrl(value) {
    const raw = clean(value);
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";

    if (digits.length > 10 && digits.indexOf("880") !== 0 && digits.indexOf("00") === 0) {
        return "https://wa.me/" + digits.replace(/^00/, "");
    }

    const intl = digits.indexOf("880") === 0
        ? digits
        : (digits.charAt(0) === "0" ? "88" + digits : digits);

    return "https://wa.me/" + intl;
}

function normalizeSocialUrl(platform, value) {
    const key = clean(platform).toLowerCase();
    const raw = clean(value);

    if (!raw || !isKnownPlatform(key)) return "";

    if (key === "whatsapp") {
        if (/^https?:\/\//i.test(raw) || raw.indexOf("//") === 0) return httpUrl(raw);
        if (!raw.replace(/\D/g, "")) return "";
        return whatsappUrl(raw);
    }

    if (/^https?:\/\//i.test(raw) || raw.indexOf("//") === 0) {
        return httpUrl(raw);
    }

    // Anything with a scheme that is not http(s) is rejected.
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";

    switch (key) {
        case "facebook":
            return handleUrl(raw, "https://facebook.com/");
        case "instagram":
            return handleUrl(raw, "https://instagram.com/");
        case "tiktok":
            return handleUrl(raw, "https://tiktok.com/", "@");
        case "youtube": {
            const path = handlePath(raw);
            if (!path) return "";
            if (/^(channel|c|user|playlist)\//i.test(path)) return "https://youtube.com/" + path;
            return "https://youtube.com/@" + path;
        }
        case "twitter":
            return handleUrl(raw, "https://x.com/");
        case "linkedin": {
            const path = handlePath(raw);
            if (!path) return "";
            if (/^(company|school|showcase|in)\//i.test(path)) return "https://linkedin.com/" + path;
            return "https://linkedin.com/in/" + path;
        }
        case "telegram": {
            const path = handlePath(raw);
            if (!path) return "";
            return "https://t.me/" + path;
        }
        case "snapchat":
            return handleUrl(raw, "https://snapchat.com/add/");
        case "discord": {
            const path = handlePath(raw);
            if (!path) return "";
            return "https://discord.gg/" + path.replace(/^invite\//, "");
        }
        case "threads":
            return handleUrl(raw, "https://threads.net/", "@");
        case "pinterest":
            return handleUrl(raw, "https://pinterest.com/");
        case "reddit": {
            const path = handlePath(raw);
            if (!path) return "";
            if (/^(r|u|user)\//i.test(path)) return "https://reddit.com/" + path;
            return "https://reddit.com/user/" + path;
        }
        case "website": {
            const url = httpUrl(raw);
            if (!url || !/[a-z0-9-]+\.[a-z]{2,}/i.test(url)) return "";
            return url;
        }
        default:
            return "";
    }
}

function parseSocialLinks(body) {
    const platforms = [].concat(
        body && body.socialPlatform != null ? body.socialPlatform : []
    );
    const urls = [].concat(
        body && body.socialUrl != null ? body.socialUrl : []
    );

    const socials = [];
    const drafts = [];
    let invalid = 0;

    platforms.forEach(function (platform, index) {
        const key = clean(platform).toLowerCase();
        const value = clean(urls[index]);

        if (!value) return;

        drafts.push({ platform: key, url: value });

        if (!isKnownPlatform(key)) {
            invalid += 1;
            return;
        }

        const url = normalizeSocialUrl(key, value);

        if (!url) {
            invalid += 1;
            return;
        }

        if (socials.length < 15) {
            socials.push({ platform: key, url: url });
        }
    });

    return { socials: socials, drafts: drafts, invalid: invalid };
}

module.exports = {
    platformList: platformList,
    isKnownPlatform: isKnownPlatform,
    normalizeSocialUrl: normalizeSocialUrl,
    parseSocialLinks: parseSocialLinks
};
