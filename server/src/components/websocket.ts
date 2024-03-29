import { RawData, WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { addRoomMember, handleSubmit, removeRoomMember, verifyUserCanJoinRoom } from "../middlewares/rooms";
import { Request } from "express";
import { WebSocketMessage } from "../types/WebSocketMessage";
import { getUserById } from "./users";

const webSocketServer = new WebSocketServer({ noServer: true });

function heartBeat() {
    webSocketServer.clients.forEach(async (webSocket: WebSocket) => {
        if (!webSocket.isAlive) {
            console.log("Found a dead websocket, terminating...");
            await removeRoomMember(webSocket.roomId, webSocket.username);
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
    webSocket.username = (req as Request).session.username!;

    await addRoomMember(roomUuid, webSocket.username);
    sendUserJoinEvent(webSocketServer, webSocket, roomUuid);

    // handle close event...
    webSocket.on("close", () => {
        removeRoomMember(roomUuid, webSocket.username);
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

function sendMessageToRoomExcept(
    webSocketServer: WebSocketServer,
    roomId: string,
    message: WebSocketMessage,
    webSocket: WebSocket
) {
    webSocketServer.clients.forEach((client) => {
        if (client.roomId === roomId && client !== webSocket) {
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

    sendMessageToRoomExcept(webSocketServer, roomId, { event: "userJoined", username: username }, webSocket);
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

            // Send the code message to everyone except the sender
            sendMessageToRoomExcept(webSocketServer, roomId, codeMessage, webSocket);
            return;
        } else if (message.event === "userSubmit") {
            const submitMessage: WebSocketMessage = {
                event: "userSubmit",
                username: username,
                message: message.code,
                language: message.language,
            }

            // TODO: Send that the user submitted a question as an EVENT message 
            sendMessageToRoom(webSocketServer, roomId, submitMessage);
            // TODO: Make API call to submit the question and await the result and send it back to the user
            // const submissionResult = await handleSubmit(submitMessage, roomId);
            // if (submissionResult != null) {
            //     sendMessageToRoom(webSocketServer, roomId, submissionResult);
            // } else {
            //     sendError(webSocket, "Error submitting question");
            // }

            return;
        }
    } catch (error) {
        // TODO: Handle the error here 
    }

    const message: WebSocketMessage = {
        event: "message",
        username: username,
        message: data.toString(),
    }

    sendMessageToRoom(webSocketServer, roomId, message);
}

async function getUsername(webSocket: WebSocket): Promise<string | null> {
    // TODO: This operation is done a lot, so we can cache the username instead in redis cache 
    const user = await getUserById(webSocket.username);

    if (!user) {
        sendError(webSocket, "User not found");
        return null;
    }

    const username = user.username;
    return username;
}

export default webSocketServer;
