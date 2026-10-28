/* ======================================================
   Cloudinary delivery helper.
   Adds f_auto (WebP/AVIF), q_auto:good and a width cap so
   existing uploads are served small without re-uploading.
   c_limit never upscales, so resolution/aspect stay intact.
====================================================== */

const UPLOAD_MARK = "/image/upload/";

function setTransform(url, width) {
    const raw = String(url || "").trim();

    if (!raw || raw.indexOf("res.cloudinary.com") === -1) return raw;
    if (raw.indexOf(UPLOAD_MARK) === -1) return raw;

    const at = raw.indexOf(UPLOAD_MARK);
    const after = raw.slice(at + UPLOAD_MARK.length);
    const first = after.split("/")[0] || "";

    /* Already carries a transformation (w_600, c_fill, …) — leave it. */
    if (first.indexOf("_") !== -1 || first.indexOf(",") !== -1) return raw;

    const parts = ["f_auto", "q_auto:good", "c_limit"];
    const w = Number(width);

    if (Number.isFinite(w) && w > 0) parts.push("w_" + Math.round(w));

    return raw.slice(0, at + UPLOAD_MARK.length) + parts.join(",") + "/" + after;
}

/* Rewrites Cloudinary <img src> URLs inside stored rich-text HTML. */
function setTransformHtml(html, width) {
    return String(html || "").replace(
        /https:\/\/res\.cloudinary\.com\/[^"'\s)]+\/image\/upload\/[^"'\s)]+/g,
        function (url) {
            return setTransform(url, width);
        }
    );
}

module.exports = { setTransform, setTransformHtml };
