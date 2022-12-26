import express, { Request } from "express";
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import argon2 from "argon2";
import dotenv from "dotenv";
dotenv.config();

import { oAuthCallbackGithub, initOAuthWithGithub, requireAuth } from "./components/authentication";
import { sendMessageToRoom } from "./components/websocket";
import sessionParser from "./components/sessionParser";
import { createRoom, getRoom, getRooms } from "./components/rooms";

const app = express();
const port = 3000;
const server = createServer(app);
const webSocketServer = new WebSocketServer({ noServer: true });

app.use(express.json());
app.use(sessionParser);

// To make a websocket connection, the client makes a GET request with an upgrade 
// header, this looks for that, checks for authentication and emmits connection 
// if authenticated.
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


webSocketServer.on("connection", async (webSocket, req) => {
    const roomUuid = req.url?.split("/")[1];

    if (!roomUuid) {
        webSocket.send("Room uuid is missing");
        webSocket.close();
        return;
    }

    const room = await getRoom(roomUuid);

    if (!room) {
        webSocket.send("Room does not exist");
        webSocket.close();
        return;
    }

    // if it has a password, check if the password is correct
    if (room.password) {
        const hashedPassword = req.headers["password"];
        if (!hashedPassword || typeof hashedPassword !== "string") {
            webSocket.send("Password is missing");
            webSocket.close();
            return;
        }

        const passwordMatches = await argon2.verify(room.password, hashedPassword);

        if (!passwordMatches) {
            webSocket.send("Incorrect password for this room...");
            webSocket.close();
            return;
        }
    }

    webSocket.roomId = roomUuid;
    sendMessageToRoom(webSocketServer, webSocket, roomUuid, "A new user has joined the room");

    // handle close event...
    webSocket.on("close", () => {
        sendMessageToRoom(webSocketServer, webSocket, roomUuid, "A user has left the room");
    });

    // handle message event...
    webSocket.on("message", (data) => {
        sendMessageToRoom(webSocketServer, webSocket, roomUuid, data);
    });
});

app.get("/", (_, res) => {
    res.send("Hello World!");
});

app.get("/login", (req, res) => initOAuthWithGithub(req, res));
app.get("/callback", (req, res) => oAuthCallbackGithub(req, res));

// Require authentication for the next endpoints...
app.use(requireAuth);

app.get("/profile", (_, res) => {
    res.json({ "message": "You are authenticated" });
});

app.get("/rooms", (_, res) => getRooms(res));
app.post("/rooms", (req, res) => createRoom(req, res));

server.listen(port, () => {
    console.log(`Listening to port ${port}`);
});
