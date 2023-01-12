import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { addRoomMember, removeRoomMember, verifyUserCanJoinRoom } from "./rooms";
import { Request } from "express";

const webSocketServer = new WebSocketServer({ noServer: true });

function heartBeat() {
    webSocketServer.clients.forEach(async (webSocket: WebSocket) => {
        if (!webSocket.isAlive) {
            console.log("Found a dead websocket, terminating...");
            await removeRoomMember(webSocket.roomId, webSocket.userId);
            return webSocket.terminate();
        }

        webSocket.isAlive = false;
        webSocket.ping();
    });
}

async function onConnection(webSocket: WebSocket, req: IncomingMessage) {
    if (!await verifyUserCanJoinRoom(webSocket, req)) return;

    const roomUuid = req.url?.split("/")[1] as string;
    webSocket.roomId = roomUuid;
    webSocket.isAlive = true;
    webSocket.userId = (req as Request).session.userId!;

    await addRoomMember(roomUuid, webSocket.userId);

    sendMessageToRoom(
        webSocketServer,
        webSocket,
        roomUuid,
        { event: "userJoined", userId: webSocket.userId }
    );

    // handle close event...
    webSocket.on("close", () => {
        removeRoomMember(roomUuid, webSocket.userId);

        sendMessageToRoom(
            webSocketServer,
            webSocket,
            roomUuid,
            { event: "userLeft", userId: webSocket.userId }
        );
    });

    // handle message event...
    webSocket.on("message", (data) => {
        const message = {
            event: "message",
            userId: webSocket.userId,
            message: data.toString(),
        }
        sendMessageToRoom(webSocketServer, webSocket, roomUuid, message);
    });

    // handle ping event...
    webSocket.on("pong", () => (webSocket.isAlive = true));
}

webSocketServer.on("connection", onConnection);

const heartBeatInterval = setInterval(heartBeat, 10000);

webSocketServer.on("close", () => {
    console.log("Websocket server closed");
    clearInterval(heartBeatInterval);
});

export function sendMessageToRoom(
    webSocketServer: WebSocketServer,
    webSocket: WebSocket,
    roomId: string,
    message: Object
) {
    webSocketServer.clients.forEach((client) => {
        if (client != webSocket && client.roomId === roomId) {
            sendJSON(client, message);
        }
    });
}

export function sendJSON(webSocket: WebSocket, message: Object) {
    webSocket.send(JSON.stringify(message));
}

export default webSocketServer;
