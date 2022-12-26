import { WebSocket, WebSocketServer } from "ws";
import argon2 from "argon2";
import { IncomingMessage } from "http";
import { getRoom } from "./rooms";

const webSocketServer = new WebSocketServer({ noServer: true });

async function verifyRoom(webSocket: WebSocket, req: IncomingMessage): Promise<boolean> {
    const roomUuid = req.url?.split("/")[1];

    if (!roomUuid) {
        webSocket.send("Room uuid is missing");
        webSocket.close();
        return false;
    }

    const room = await getRoom(roomUuid);

    if (!room) {
        webSocket.send("Room does not exist");
        webSocket.close();
        return false;
    }

    // if it has a password, check if the password is correct
    if (room.password) {
        const hashedPassword = req.headers["password"];
        if (!hashedPassword || typeof hashedPassword !== "string") {
            webSocket.send("Password is missing");
            webSocket.close();
            return false;
        }

        const passwordMatches = await argon2.verify(room.password, hashedPassword);

        if (!passwordMatches) {
            webSocket.send("Incorrect password for this room...");
            webSocket.close();
            return false;
        }
    }

    return true;
}

function heartBeat() {
    webSocketServer.clients.forEach((webSocket: WebSocket) => {
        if (!webSocket.isAlive) {
            console.log("Found a dead websocket, terminating...");
            return webSocket.terminate();
        }

        webSocket.isAlive = false;
        webSocket.ping();
    });
}

async function onConnection(webSocket: WebSocket, req: IncomingMessage) {
    if (!verifyRoom(webSocket, req)) return;

    const roomUuid = req.url?.split("/")[1] as string;
    webSocket.roomId = roomUuid;
    webSocket.isAlive = true;

    sendMessageToRoom(
        webSocketServer,
        webSocket,
        roomUuid,
        "A new user has joined the room"
    );

    // handle close event...
    webSocket.on("close", () => {
        sendMessageToRoom(
            webSocketServer,
            webSocket,
            roomUuid,
            "A user has left the room"
        );
    });

    // handle message event...
    webSocket.on("message", (data) => {
        sendMessageToRoom(webSocketServer, webSocket, roomUuid, data);
    });

    // handle ping event...
    webSocket.on("pong", () => (webSocket.isAlive = true));
}

webSocketServer.on("connection", onConnection);

const heartBeatInterval = setInterval(heartBeat, 1000);

webSocketServer.on("close", () => {
    console.log("Websocket server closed");
    clearInterval(heartBeatInterval);
});

export function sendMessageToRoom(
    webSocketServer: WebSocketServer,
    webSocket: WebSocket,
    roomId: string,
    message: any
) {
    webSocketServer.clients.forEach((client) => {
        if (client != webSocket && client.roomId === roomId) {
            client.send(message);
        }
    });
}

export default webSocketServer;
