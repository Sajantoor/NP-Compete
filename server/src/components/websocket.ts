import { RawData, WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { addRoomMember, removeRoomMember, verifyUserCanJoinRoom } from "../middlewares/rooms";
import { Request } from "express";
import { WebSocketMessage } from "../types/WebSocketMessage";
import { getUserById } from "./users";

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
    sendUserJoinEvent(webSocketServer, webSocket, roomUuid);

    // handle close event...
    webSocket.on("close", () => {
        removeRoomMember(roomUuid, webSocket.userId);
        sendUserLeftEvent(webSocketServer, webSocket, roomUuid)
    });

    // handle message event...
    webSocket.on("message", (data) => {
        sendUserMessage(webSocketServer, webSocket, roomUuid, data);
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

function sendMessageToRoom(
    webSocketServer: WebSocketServer,
    roomId: string,
    message: WebSocketMessage
) {
    webSocketServer.clients.forEach((client) => {
        if (client.roomId === roomId) {
            sendJSON(client, message);
        }
    });
}

function sendJSON(webSocket: WebSocket, message: WebSocketMessage) {
    webSocket.send(JSON.stringify(message));
}

export function sendError(webSocket: WebSocket, message: string) {
    sendJSON(webSocket, { event: "error", message });
}

async function sendUserJoinEvent(webSocketServer: WebSocketServer, webSocket: WebSocket, roomId: string) {
    const username = await getUsername(webSocket);
    if (!username) return;

    sendMessageToRoom(webSocketServer, roomId, { event: "userJoined", username: username });
}

async function sendUserLeftEvent(webSocketServer: WebSocketServer, webSocket: WebSocket, roomId: string) {
    const username = await getUsername(webSocket);
    if (!username) return;

    sendMessageToRoom(webSocketServer, roomId, { event: "userLeft", username: username });
}

async function sendUserMessage(webSocketServer: WebSocketServer, webSocket: WebSocket, roomId: string, data: RawData) {
    const username = await getUsername(webSocket);
    if (!username) return;

    // Check the type of message, if it's a code message handle it differently
    // The code message will be a stringified JSON object
    try {
        const message = JSON.parse(data.toString());
        if (message.event === "code") {
            const codeMessage: WebSocketMessage = {
                event: "code",
                username: username,
                code: message.code,
                language: message.language,
            }

            sendMessageToRoom(webSocketServer, roomId, codeMessage);
            console.log(codeMessage);
            return;
        }
    } catch (error) {
        // Do nothing
    }

    const message: WebSocketMessage = {
        event: "message",
        username: username,
        message: data.toString(),
    }

    sendMessageToRoom(webSocketServer, roomId, message);
}

async function getUsername(webSocket: WebSocket): Promise<string | null> {
    const user = await getUserById(webSocket.userId);
    if (!user) {
        sendError(webSocket, "User not found");
        return null;
    }
    const username = user.username;
    return username;
}

export default webSocketServer;
