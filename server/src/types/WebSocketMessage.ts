export interface WebSocketMessage {
    event: "userJoined" | "userLeft" | "message" | "error";
    userId?: string;
    message?: string;
}