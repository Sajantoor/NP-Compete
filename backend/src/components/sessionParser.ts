import session from "express-session";
import connectRedis from "connect-redis";
import { COOKIE_NAME, IS_PRODUCTION } from "../utilities/constants";
import { redisClient } from "./redis";

const RedisStore = connectRedis(session);

// Use session middleware to save session cookies for authentication
const sessionParser = session({
    name: COOKIE_NAME,
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        sameSite: "lax",
        secure: IS_PRODUCTION, // cookie only works in https
    },
    store: new RedisStore({
        client: redisClient,
        disableTouch: true,
    }),
});

export default sessionParser;
