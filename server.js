const path = require("path");
const express = require("express");
const compression = require("compression");

const config = require("./config/env");
const connectDB = require("./config/db");
const sessionMiddleware = require("./config/session");

const {
    notFoundHandler,
    errorHandler
} = require("./middleware/errorHandler");

const {
    attachAdmin,
    attachCustomer
} = require("./middleware/auth");

const {
    cloudinary
} = require("./middleware/upload");

const upload = require("./middleware/upload");

const app = express();

app.disable("x-powered-by");


// ======================================================
// TRUST PROXY
// ======================================================

app.set("trust proxy", 1);


// ======================================================
// COMPRESSION
// ======================================================

app.use(compression());


// ======================================================
// DATABASE
// ======================================================

connectDB();


// ======================================================
// SITE SETTINGS
// ======================================================

require("./utils/siteSettings").loadSettings();


// ======================================================
// VIEW ENGINE
// ======================================================

app.set("view engine", "ejs");

app.set(
    "views",
    path.join(__dirname, "views")
);

app.locals.mailConfigured = function () {
    return require("./utils/mailer").isMailConfigured();
};

app.locals.oauthConfigured = function (provider) {
    return require("./utils/oauth").isConfigured(provider);
};

app.locals.whatsappConfigured = function () {
    return require("./utils/whatsapp").isConfigured();
};

const images = require("./utils/images");

app.locals.optimizeImage = images.setTransform;

app.locals.optimizeHtml = images.setTransformHtml;


// ======================================================
// BODY PARSER
// ======================================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ======================================================
// SESSION
// ======================================================

app.use(sessionMiddleware);


// ======================================================
// GLOBAL ADMIN DATA
// ======================================================

app.use(attachAdmin);


// ======================================================
// GLOBAL CUSTOMER DATA
// ======================================================

app.use(attachCustomer);


// ======================================================
// GLOBAL SITE DATA
// ======================================================

app.use(
    require("./middleware/siteData")
);


// ======================================================
// STOREFRONT TRAFFIC (SEO & MARKETING DASHBOARD)
// ======================================================

app.use(
    require("./middleware/traffic")
);


// ======================================================
// RESPONSE TIMING (ADMIN SPEED PAGE)
// ======================================================

app.use(
    require("./middleware/perf")
);


// ======================================================
// STATIC FILES
// ======================================================

app.use(
    express.static(
        path.join(__dirname, "public"),
        {
            maxAge: "30d",
            etag: true,

            setHeaders: function (res, filePath) {

                if (
                    /[\/\\]uploads[\/\\]/.test(filePath)
                ) {

                    res.setHeader(
                        "Cache-Control",
                        "public, max-age=31536000, immutable"
                    );

                }
            }
        }
    )
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
    "/health",
    function (req, res) {

        res.status(200).json({
            success: true,
            status: "OK",
            environment: config.nodeEnv,
            timestamp: new Date().toISOString()
        });

    }
);


// ======================================================
// CLOUDINARY CONNECTION TEST
// ======================================================

cloudinary.api.ping()
    .then(function () {

        console.log(
            "Cloudinary connection: OK"
        );

    })
    .catch(function (error) {

        console.error(
            "Cloudinary connection failed:"
        );

        console.error(
            error.message
        );

    });


// ======================================================
// AUTH ROUTES
// ======================================================

app.use(
    "/admin",
    require("./routes/authRoutes")
);


// ======================================================
// ADMIN ROUTES
// ======================================================

app.use(
    "/admin",
    require("./routes/adminRoutes")
);


// ======================================================
// CUSTOMER AUTH ROUTES
// ======================================================

app.use(
    "/",
    require("./routes/customerRoutes")
);


// ======================================================
// WEBSITE ROUTES
// ======================================================

app.use(
    "/",
    require("./routes/webRoutes")
);


// ======================================================
// 404
// ======================================================

app.use(
    notFoundHandler
);


// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
    errorHandler
);


// ======================================================
// START SERVER
// ======================================================

const PORT = config.port;

const server = app.listen(
    PORT,
    function () {

        console.log("");

        console.log(
            "=========================================="
        );

        console.log(
            "       MIZANTRADE SERVER STARTED"
        );

        console.log(
            "=========================================="
        );

        console.log(
            "Environment : " + config.nodeEnv
        );

        console.log(
            "Port        : " + PORT
        );

        console.log(
            "Website     : " + config.siteUrl
        );

        console.log(
            "Health      : " +
            config.siteUrl +
            "/health"
        );

        console.log(
            "Admin Login : " +
            config.siteUrl +
            "/admin/login"
        );

        console.log(
            "Cloudinary  : " +
            (
                config.cloudinary.cloudName
                    ? "Configured"
                    : "Missing"
            )
        );

        console.log(
            "=========================================="
        );

        console.log("");

    }
);


// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

function shutdown() {

    console.log(
        "Shutting down MizanTrade server..."
    );

    server.close(
        function () {

            console.log(
                "Server closed."
            );

            process.exit(0);

        }
    );
}


process.on(
    "SIGTERM",
    shutdown
);

process.on(
    "SIGINT",
    shutdown
);