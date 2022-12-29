import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { verifyUserCanJoinRoom } from "./rooms";
import { RedisCache } from "./redis";
import { Request } from "express";

const webSocketServer = new WebSocketServer({ noServer: true });

function heartBeat() {
    webSocketServer.clients.forEach((webSocket: WebSocket) => {
        if (!webSocket.isAlive) {
            console.log("Found a dead websocket, terminating...");
            RedisCache.removeRoomMember(webSocket.roomId, webSocket.userId);
            return webSocket.terminate();
        }

        webSocket.isAlive = false;
        webSocket.ping();
    });
}

async function onConnection(webSocket: WebSocket, req: IncomingMessage) {
    if (!verifyUserCanJoinRoom(webSocket, req)) return;

    const roomUuid = req.url?.split("/")[1] as string;
    webSocket.roomId = roomUuid;
    webSocket.isAlive = true;
    webSocket.userId = (req as Request).session.userId!;

    await RedisCache.addRoomMember(roomUuid, webSocket.userId);

    sendMessageToRoom(
        webSocketServer,
        webSocket,
        roomUuid,
        "A new user has joined the room"
    );

    // handle close event...
    webSocket.on("close", () => {
        RedisCache.removeRoomMember(roomUuid, webSocket.userId);

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
