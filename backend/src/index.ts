import express, { Request } from "express";
import session from "express-session";
import dotenv from "dotenv";
import { createClient } from "redis";
import connectRedis from 'connect-redis';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { oAuthCallbackGithub, initOAuthWithGithub, requireAuth } from "./authentication";
import { sendMessageToRoom } from "./websocket";
import { COOKIE_NAME, IS_PRODUCTION } from "./constants";

dotenv.config();

const app = express();
const port = 3000;
const server = createServer(app);
const webSocketServer = new WebSocketServer({ noServer: true });
const RedisStore = connectRedis(session);
export const redisClient = createClient({ legacyMode: true });
redisClient.connect().catch(console.error);

// Use session middleware to save session cookies for authentication 
const sessionParser = session({
    name: COOKIE_NAME,
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PRODUCTION, // cookie only works in https
    },
    store: new RedisStore({
        client: redisClient,
        disableTouch: true,
    }),
});

app.use(sessionParser);

server.on("upgrade", async function upgrade(request, socket, head) {
    // @ts-ignore, TODO: Types don't match but this works, find a solution.
    sessionParser(request, {}, () => {
        const req = request as Request;

        if (!req.session.userId) {
            socket.write("401 Unauthorized.\n");
            socket.destroy();
            return;
        }

        webSocketServer.handleUpgrade(req, socket, head, (ws) => {
            webSocketServer.emit("connection", ws, req);
        });
    });
});

webSocketServer.on("connection", (webSocket, req) => {
    const roomId = req.url;

    if (roomId == null) {
        webSocket.close();
        return;
    }

    webSocket.roomId = roomId;
    sendMessageToRoom(webSocketServer, webSocket, roomId, "A new user has joined the room");

    // handle close event...
    webSocket.on("close", () => {
        sendMessageToRoom(webSocketServer, webSocket, roomId, "A user has left the room");
    });

    // handle message event...
    webSocket.on("message", (data) => {
        sendMessageToRoom(webSocketServer, webSocket, roomId, data);
    });
});

app.get("/", (_, res) => {
    res.send("Hello World!");
});

app.get("/login", (req, res) => {
    initOAuthWithGithub(req, res);
});

app.get("/callback", (req, res) => {
    oAuthCallbackGithub(req, res);
});

app.get("/profile", requireAuth, (_, res) => {
    res.send("You are logged in....");
});

server.listen(port, () => {
    console.log(`Listening to port ${port}`);
});