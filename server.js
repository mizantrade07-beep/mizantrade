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


const app = express();


// ======================================================
// COMPRESSION (gzip) — রেসপন্স সাইজ কমানো
// ======================================================

app.use(compression());


// ======================================================
// DATABASE
// ======================================================

connectDB();


// ======================================================
// VIEW ENGINE
// ======================================================

app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(__dirname, "views")
);


// ======================================================
// BODY PARSER
// ======================================================

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


// ======================================================
// SESSION
// ======================================================

app.use(
    sessionMiddleware
);


// ======================================================
// GLOBAL ADMIN DATA
// ======================================================

app.use(
    attachAdmin
);


// ======================================================
// GLOBAL CUSTOMER DATA
// ======================================================

app.use(
    attachCustomer
);


// ======================================================
// GLOBAL SITE DATA (categories, cart count)
// ======================================================

app.use(
    require("./middleware/siteData")
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
                // আপলোড করা ছবির ফাইলনাম ইউনিক — দীর্ঘমেয়াদি immutable ক্যাশ
                if (/[\\/]uploads[\\/]/.test(filePath)) {
                    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
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
    (req, res) => {
        res.status(200).json({
            success: true,
            status: "OK",
            environment: config.nodeEnv,
            timestamp: new Date().toISOString()
        });
    }
);


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
// CUSTOMER AUTH ROUTES (signup / login / account)
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
    () => {
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
            `Environment : ${config.nodeEnv}`
        );

        console.log(
            `Port        : ${PORT}`
        );

        console.log(
            `Website     : http://localhost:${PORT}`
        );

        console.log(
            `Health      : http://localhost:${PORT}/health`
        );

        console.log(
            `Admin Login : http://localhost:${PORT}/admin/login`
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

const shutdown = () => {
    console.log(
        "Shutting down MizanTrade server..."
    );

    server.close(() => {
        console.log(
            "Server closed."
        );

        process.exit(0);
    });
};


process.on(
    "SIGTERM",
    shutdown
);

process.on(
    "SIGINT",
    shutdown
);