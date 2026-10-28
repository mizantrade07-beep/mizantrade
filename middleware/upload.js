const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

/* ======================================================
   CLOUDINARY CONFIGURATION
====================================================== */

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ======================================================
   SAFE CONFIG CHECK
   Secret কখনো console-এ দেখাবে না
====================================================== */

if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error("❌ Cloudinary CLOUD_NAME is missing");
}

if (!process.env.CLOUDINARY_API_KEY) {
    console.error("❌ Cloudinary API_KEY is missing");
}

if (!process.env.CLOUDINARY_API_SECRET) {
    console.error("❌ Cloudinary API_SECRET is missing");
}

/* ======================================================
   PRODUCT IMAGE STORAGE
====================================================== */

const productStorage = new CloudinaryStorage({
    cloudinary,

    params: {
        folder: "mizantrade/products",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],

        transformation: [
            {
                width: 1600,
                crop: "limit",
                quality: "auto:good",
                fetch_format: "auto"
            }
        ]
    }
});

/* ======================================================
   PRODUCT IMAGE FILTER
====================================================== */

function productFileFilter(req, file, cb) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        return cb(null, true);
    }

    return cb(
        new Error(
            "Only JPG, JPEG, PNG and WEBP images are allowed."
        ),
        false
    );
}

/* ======================================================
   PRODUCT UPLOAD
====================================================== */

const upload = multer({
    storage: productStorage,

    fileFilter: productFileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

/* ======================================================
   TEAM PHOTO STORAGE
====================================================== */

const teamStorage = new CloudinaryStorage({
    cloudinary,

    params: {
        folder: "mizantrade/team",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],

        transformation: [
            {
                width: 600,
                height: 600,
                crop: "fill",
                gravity: "face",
                quality: "auto",
                fetch_format: "auto"
            }
        ]
    }
});

const uploadTeam = multer({
    storage: teamStorage,

    fileFilter: productFileFilter,

    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

/* ======================================================
   RICH TEXT MEDIA STORAGE
====================================================== */

const mediaStorage = new CloudinaryStorage({
    cloudinary,

    params: async (req, file) => {
        const base = {
            folder: "mizantrade/media",
            resource_type: "auto",
            allowed_formats: [
                "jpg",
                "jpeg",
                "png",
                "webp",
                "mp4",
                "webm"
            ]
        };

        /* Images are downscaled to a sane width and re-compressed on
           upload; videos are stored as-is. */
        if (String(file.mimetype || "").indexOf("image/") === 0) {
            base.transformation = [
                {
                    width: 1600,
                    crop: "limit",
                    quality: "auto:good",
                    fetch_format: "auto"
                }
            ];
        }

        return base;
    }
});

/* ======================================================
   MEDIA FILTER
====================================================== */

function mediaFilter(req, file, cb) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/webm"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        return cb(null, true);
    }

    return cb(
        new Error(
            "Only JPG, PNG, WEBP images and MP4/WEBM videos are allowed."
        ),
        false
    );
}

/* ======================================================
   MEDIA UPLOAD
====================================================== */

const uploadMedia = multer({
    storage: mediaStorage,

    fileFilter: mediaFilter,

    limits: {
        fileSize: 60 * 1024 * 1024
    }
});

/* ======================================================
   PARTNER DOCUMENT STORAGE
====================================================== */

const partnerDocStorage = new CloudinaryStorage({
    cloudinary,

    params: {
        folder: "mizantrade/partners",
        resource_type: "auto",
        allowed_formats: [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "pdf"
        ]
    }
});

/* ======================================================
   PARTNER DOCUMENT FILTER
====================================================== */

function partnerDocFilter(req, file, cb) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        return cb(null, true);
    }

    return cb(
        new Error(
            "Only JPG, PNG, WEBP and PDF files are allowed."
        ),
        false
    );
}

/* ======================================================
   PARTNER DOCUMENT UPLOAD
====================================================== */

const uploadPartnerDocs = multer({
    storage: partnerDocStorage,

    fileFilter: partnerDocFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

/* ======================================================
   WORD / EXCEL IMPORT (in-memory)
====================================================== */

const importFile = multer({
    storage: multer.memoryStorage(),

    fileFilter: function (req, file, cb) {
        const ext = String(file.originalname || "")
            .toLowerCase()
            .split(".")
            .pop();

        if (ext === "docx" || ext === "xlsx") {
            return cb(null, true);
        }

        return cb(
            new Error("Only Word (.docx) and Excel (.xlsx) files are allowed."),
            false
        );
    },

    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

/* ======================================================
   EXPORTS
====================================================== */

module.exports = upload;

module.exports.team = uploadTeam;

module.exports.partnerDocs = uploadPartnerDocs;

module.exports.media = uploadMedia;

module.exports.importFile = importFile;

module.exports.cloudinary = cloudinary;