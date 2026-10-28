/* ======================================================
   SMS helper — bulksmsbd.net HTTP API
   Credentials live in .env (SMS_API_KEY / SMS_SENDER_ID);
   nothing sensitive is hardcoded here.
====================================================== */

const DEFAULT_ENDPOINT = "https://bulksmsbd.net/api/smsapi";

function apiKey() {
    return String(process.env.SMS_API_KEY || "").trim();
}

function senderId() {
    return String(process.env.SMS_SENDER_ID || "").trim();
}

function endpoint() {
    return String(process.env.SMS_API_URL || DEFAULT_ENDPOINT).trim();
}

function isConfigured() {
    return Boolean(apiKey());
}

/* Normalise a Bangladeshi mobile number to the 01XXXXXXXXX form. */
function normalizePhone(raw) {
    let n = String(raw || "").replace(/[^0-9]/g, "");
    if (n.startsWith("880")) n = n.slice(3);
    if (n.length === 10 && !n.startsWith("0")) n = "0" + n;
    return n;
}

/* The gateway echoes the API key inside some error messages — never log it. */
function scrub(text) {
    const key = apiKey();
    return key ? String(text || "").split(key).join("***") : String(text || "");
}

/* Send a text SMS. Resolves to { ok, status, code, body, error? } — never throws.
   Set SMS_MODE=console to log instead of calling the API (local testing).
   The gateway answers HTTP 200 for errors too, so only response_code 202 counts
   as a successful hand-off. */
async function sendSms(number, message) {
    const phone = normalizePhone(number);

    if (String(process.env.SMS_MODE || "").toLowerCase() === "console") {
        console.log("[SMS:console] to=" + phone + " msg=" + message);
        return { ok: true, status: 200, code: 202, body: "console" };
    }

    if (!isConfigured()) {
        return { ok: false, error: "SMS not configured" };
    }
    if (!/^01[3-9]\d{8}$/.test(phone)) {
        return { ok: false, error: "Invalid mobile number" };
    }

    // Docs recommend the 8801XXXXXXXXX form.
    const gatewayNumber = "880" + phone.slice(1);

    const url =
        endpoint() +
        "?api_key=" + encodeURIComponent(apiKey()) +
        "&type=text" +
        "&number=" + encodeURIComponent(gatewayNumber) +
        "&senderid=" + encodeURIComponent(senderId()) +
        "&message=" + encodeURIComponent(message);

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const body = scrub(await res.text());

        let code = null;
        let providerMessage = "";
        try {
            const json = JSON.parse(body);
            code = Number(json.response_code);
            providerMessage = String(
                json.error_message || json.success_message || ""
            );
        } catch (_) {
            // Non-JSON reply — treated as a failure below.
        }

        if (code !== 202) {
            return {
                ok: false,
                status: res.status,
                code,
                body,
                error: providerMessage || "Gateway rejected the SMS (no response code)"
            };
        }

        return { ok: true, status: res.status, code, body };
    } catch (err) {
        return {
            ok: false,
            error:
                err.name === "TimeoutError"
                    ? "SMS gateway timed out"
                    : scrub(err.message)
        };
    }
}

module.exports = { sendSms, isConfigured, normalizePhone };
