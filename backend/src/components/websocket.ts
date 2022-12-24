import { WebSocket, WebSocketServer } from "ws";

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
