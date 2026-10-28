/* ======================================================
   RICH HTML SANITIZER (server side)
   Offer content can come from Word/Excel imports or a paste.
   Keeps formatting, tables and images, removes anything active.
====================================================== */

function sanitizeRichHtml(html) {
    let out = String(html || "");

    if (!out.trim()) return "";

    // comments + Word conditional comments
    out = out.replace(/<!--[\s\S]*?-->/g, "");

    // active / layout-breaking elements (paired then self-closing)
    out = out.replace(
        /<\s*(script|style|iframe|object|embed|form|input|button|select|textarea|link|meta|base|title)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        ""
    );
    out = out.replace(
        /<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|select|textarea|link|meta|base|title)\b[^>]*\/?>/gi,
        ""
    );

    // inline event handlers
    out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

    // javascript: / vbscript: / html data URLs
    out = out.replace(
        /\s(href|src|xlink:href)\s*=\s*("|')\s*(?:javascript|vbscript|data:text\/html)[^"']*("|')/gi,
        ' $1="#"'
    );

    // CSS expression() + javascript URLs inside styles
    out = out.replace(/expression\s*\(/gi, "(");
    out = out.replace(/url\s*\(\s*("|')?\s*javascript:[^)]*\)/gi, "none");

    // Word/Excel namespace tags like <o:p> ... </o:p> keep their content
    out = out.replace(/<\s*\/?\s*[a-z0-9]+:[a-z0-9]+\b[^>]*>/gi, "");

    // Word Mso classes on elements
    out = out.replace(/\sclass\s*=\s*("[^"]*mso[^"]*"|'[^']*mso[^']*')/gi, "");

    return out.trim();
}

module.exports = {
    sanitizeRichHtml: sanitizeRichHtml
};
