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

        secure: config.nodeEnv === "production",

        sameSite: "lax",

        maxAge: 8 * 60 * 60 * 1000
    }
});

module.exports = sessionMiddleware;