export interface WebSocketMessage {
    event: "userJoined" | "userLeft" | "message" | "error";
    userId?: number;
    message?: string;
}