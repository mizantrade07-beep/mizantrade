const multer = require("multer");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

/* ======================================================
   CLOUDINARY CONFIGURATION
====================================================== */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ======================================================
   STORAGE (Products / Standard Images)
====================================================== */
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'mizantrade/uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
});

/* ======================================================
   FILE FILTER
====================================================== */
function fileFilter(
    req,
    file,
    cb
) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg"
    ];

    if (
        allowedTypes.includes(
            file.mimetype
        )
    ) {
        cb(
            null,
            true
        );
    } else {
        cb(
            new Error(
                "Only JPG, JPEG, PNG and WEBP images are allowed."
            )
        );
    }
}

/* ======================================================
   MULTER
====================================================== */
const upload =
    multer({
        storage,
        fileFilter,

        limits: {
            fileSize:
                5 * 1024 * 1024
        }
    });


/* ======================================================
   MEDIA (IMAGES + VIDEO) FOR RICH TEXT EDITORS
====================================================== */
const mediaStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'mizantrade/media',
        resource_type: 'auto', // ভিডিও এবং ছবি উভয়ই সাপোর্ট করার জন্য
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'mp4', 'webm']
    }
});

function mediaFilter(
    req,
    file,
    cb
) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
        "video/mp4",
        "video/webm"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, PNG, WEBP images and MP4/WEBM videos are allowed."));
    }
}

const uploadMedia =
    multer({
        storage: mediaStorage,
        fileFilter: mediaFilter,

        limits: {
            fileSize: 60 * 1024 * 1024
        }
    });


/* ======================================================
   PARTNER DOCUMENTS (Cloudinary-এর প্রাইভেট ফোল্ডার বা Raw ফাইল হিসেবে)
====================================================== */
const partnerDocStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'mizantrade/partners',
        resource_type: 'auto', // PDF বা ছবির জন্য
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf']
    }
});


function partnerDocFilter(
    req,
    file,
    cb
) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
        "application/pdf"
    ];

    if (
        allowedTypes.includes(
            file.mimetype
        )
    ) {
        cb(
            null,
            true
        );
    } else {
        cb(
            new Error(
                "Only JPG, PNG, WEBP and PDF files are allowed."
            )
        );
    }
}


const uploadPartnerDocs =
    multer({
        storage: partnerDocStorage,
        fileFilter: partnerDocFilter,

        limits: {
            fileSize:
                5 * 1024 * 1024
        }
    });


module.exports = upload;
module.exports.partnerDocs = uploadPartnerDocs;
module.exports.media = uploadMedia;