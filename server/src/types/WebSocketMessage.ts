export interface WebSocketMessage {
    event: "userJoined" | "userLeft" | "message" | "error" | "code";
    username?: string;
    message?: string;
    code?: string; // Used on code messages
    language?: string; // Used on code messages 
}