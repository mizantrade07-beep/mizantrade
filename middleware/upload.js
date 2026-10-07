const multer = require("multer");
const path = require("path");
const fs = require("fs");


/* ======================================================
   UPLOAD DIRECTORY
====================================================== */

const uploadDirectory =
    path.join(
        __dirname,
        "..",
        "public",
        "uploads"
    );


if (
    !fs.existsSync(uploadDirectory)
) {
    fs.mkdirSync(
        uploadDirectory,
        {
            recursive: true
        }
    );
}


/* ======================================================
   STORAGE
====================================================== */

const storage =
    multer.diskStorage({

        destination: function (
            req,
            file,
            cb
        ) {
            cb(
                null,
                uploadDirectory
            );
        },


        filename: function (
            req,
            file,
            cb
        ) {

            const extension =
                path.extname(
                    file.originalname
                ).toLowerCase();


            const filename =
                Date.now() +
                "-" +
                Math.round(
                    Math.random() * 1e9
                ) +
                extension;


            cb(
                null,
                filename
            );
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
   PARTNER DOCUMENTS (PRIVATE STORAGE)
====================================================== */

const partnerDocDirectory =
    path.join(
        __dirname,
        "..",
        "storage",
        "private",
        "partners"
    );


if (
    !fs.existsSync(partnerDocDirectory)
) {
    fs.mkdirSync(
        partnerDocDirectory,
        {
            recursive: true
        }
    );
}


const partnerDocStorage =
    multer.diskStorage({

        destination: function (
            req,
            file,
            cb
        ) {
            cb(
                null,
                partnerDocDirectory
            );
        },


        filename: function (
            req,
            file,
            cb
        ) {

            const extension =
                path.extname(
                    file.originalname
                ).toLowerCase();


            const filename =
                Date.now() +
                "-" +
                Math.round(
                    Math.random() * 1e9
                ) +
                extension;


            cb(
                null,
                filename
            );
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