import express, { Request } from "express";
import { createServer } from 'http';
import dotenv from "dotenv";
dotenv.config();

import { oAuthCallbackGithub, initOAuthWithGithub, requireAuth } from "./components/authentication";
import webSocketServer from "./components/websocket";
import sessionParser from "./components/sessionParser";
import { createRoom, getRoom, getRooms, patchRoom } from "./components/rooms";

const app = express();
const port = 3000;
const server = createServer(app);

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
app.get("/rooms/:uuid", (req, res) => getRoom(req, res));
app.post("/rooms", (req, res) => createRoom(req, res));
app.patch("/rooms/:uuid", (req, res) => patchRoom(req, res));

server.listen(port, () => {
    console.log(`Listening to port ${port}`);
});
