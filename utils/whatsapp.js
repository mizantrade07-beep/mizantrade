/* ======================================================
   WhatsApp Cloud API helper
   Credentials live in .env (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID).
   Optional WHATSAPP_API_VERSION (default v25.0; v20.0 was removed by Meta
   on 2026-09-24).

   OTPs should use an approved Authentication template
   (WHATSAPP_OTP_TEMPLATE + WHATSAPP_OTP_TEMPLATE_LANG): Cloud API
   rejects free-form text outside a customer's 24-hour window.
   Without a template the OTP is sent as plain text, which only
   works in a test setup or inside an open conversation.

   Never throws; the token is never logged.
====================================================== */

function token() {
    return String(process.env.WHATSAPP_TOKEN || "").trim();
}

function phoneId() {
    return String(process.env.WHATSAPP_PHONE_ID || "").trim();
}

function isConfigured() {
    return Boolean(token() && phoneId());
}

/* 01XXXXXXXXX → 8801XXXXXXXXX */
function toWhatsAppNumber(phone) {
    let n = String(phone || "").replace(/[^0-9]/g, "");
    if (n.startsWith("880")) return n;
    if (n.startsWith("0")) return "88" + n;
    if (n.length === 10) return "880" + n;
    return n;
}

async function postMessage(payload) {
    if (!isConfigured()) {
        return { ok: false, error: "WhatsApp not configured" };
    }

    const version = String(process.env.WHATSAPP_API_VERSION || "v25.0");

    try {
        const res = await fetch(
            "https://graph.facebook.com/" + version + "/" + phoneId() + "/messages",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token(),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const body = await res.text();
        return { ok: res.ok, status: res.status, body };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

async function sendWhatsApp(number, message) {
    const to = toWhatsAppNumber(number);
    if (!/^8801[3-9]\d{8}$/.test(to)) {
        return { ok: false, error: "Invalid WhatsApp number" };
    }

    return postMessage({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: String(message).slice(0, 4000) }
    });
}

async function sendWhatsAppOtp(number, code) {
    const template = String(process.env.WHATSAPP_OTP_TEMPLATE || "").trim();

    if (!template) {
        return sendWhatsApp(
            number,
            "Your MizanTrade verification code is " + code + ". It expires in 5 minutes."
        );
    }

    const to = toWhatsAppNumber(number);
    if (!/^8801[3-9]\d{8}$/.test(to)) {
        return { ok: false, error: "Invalid WhatsApp number" };
    }

    return postMessage({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
            name: template,
            language: {
                code: String(process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en_US").trim()
            },
            components: [
                {
                    type: "body",
                    parameters: [{ type: "text", text: String(code) }]
                }
            ]
        }
    });
}

module.exports = {
    sendWhatsApp,
    sendWhatsAppOtp,
    isConfigured,
    toWhatsAppNumber
};
