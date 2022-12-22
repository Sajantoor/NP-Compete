import express from "express";
import dotenv from "dotenv";
import { oAuthCallbackGithub, initOAuthWithGithub } from "./authentication";
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { sendMessageToRoom } from "./websocket";

dotenv.config();

const app = express();
const port = 3000;
const server = createServer(app);
const webSocketServer = new WebSocketServer({ server });

webSocketServer.on("connection", (webSocket, req) => {
    // TODO: need to authenticate each user....
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

app.get("/login", (_, res) => {
    initOAuthWithGithub(res);
});

app.get("/callback", (req, res) => {
    oAuthCallbackGithub(req, res);
});

server.listen(port, () => {
    console.log(`Listening to port ${port}`);
})