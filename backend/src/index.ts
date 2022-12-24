import express, { Request } from "express";
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from "dotenv";
dotenv.config();

import { oAuthCallbackGithub, initOAuthWithGithub, requireAuth } from "./components/authentication";
import { sendMessageToRoom } from "./components/websocket";
import sessionParser from "./components/sessionParser";

const app = express();
const port = 3000;
const server = createServer(app);
const webSocketServer = new WebSocketServer({ noServer: true });

app.use(sessionParser);

// I'm not sure how this works but this used since verifyClient is pretty much 
// deprecated: https://github.com/websockets/ws/issues/377#issuecomment-462152231
server.on("upgrade", async function upgrade(request, socket, head: Buffer) {
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
