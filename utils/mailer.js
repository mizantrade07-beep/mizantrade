/* ======================================================
   E-mail helper (nodemailer SMTP)
   Credentials live in .env (SMTP_HOST / SMTP_PORT / SMTP_USER /
   SMTP_PASS / SMTP_SECURE). Set EMAIL_MODE=console to log instead
   of sending — used for local testing. Never throws.
====================================================== */

const nodemailer = require("nodemailer");

function isMailConfigured() {
    return Boolean(
        String(process.env.SMTP_HOST || "").trim() &&
        String(process.env.SMTP_USER || "").trim() &&
        String(process.env.SMTP_PASS || "").trim()
    );
}

async function sendMail({ to, subject, text, html }) {
    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to];

    if (recipients.length === 0) {
        return { ok: false, error: "No recipient" };
    }

    if (String(process.env.EMAIL_MODE || "").toLowerCase() === "console") {
        recipients.forEach((r) =>
            console.log("[EMAIL:console] to=" + r + " subject=" + subject)
        );
        return { ok: true, body: "console" };
    }

    if (!isMailConfigured()) {
        console.warn("[EMAIL] SMTP not configured — skipped:", subject);
        return { ok: false, error: "SMTP not configured" };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || "") === "1",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        });

        const info = await transporter.sendMail({
            from: String(process.env.SMTP_FROM || process.env.SMTP_USER),
            to: recipients.join(", "),
            subject,
            text,
            html
        });

        return { ok: true, body: info.messageId };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

module.exports = { sendMail, isMailConfigured };
