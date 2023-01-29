export interface WebSocketMessage {
    event: "userJoined" | "userLeft" | "message" | "error";
    username?: string;
    message?: string;
}