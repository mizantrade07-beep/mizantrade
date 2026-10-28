const session = require("express-session");
const MongoStore = require("connect-mongo");

const config = require("./env");

const sessionMiddleware = session({
    name: "mizantrade.sid",

    secret: config.sessionSecret,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: config.mongoUri,
        collectionName: "sessions",
        ttl: 8 * 60 * 60
    }),

    cookie: {
        httpOnly: true,

        // "auto" sets the Secure flag whenever the request is HTTPS, so admin
        // login keeps working if the live server is ever reached over HTTP.
        secure: config.nodeEnv === "production" ? "auto" : false,

        sameSite: "lax",

        maxAge: 8 * 60 * 60 * 1000
    }
});

module.exports = sessionMiddleware;