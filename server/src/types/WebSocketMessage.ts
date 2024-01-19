export interface WebSocketMessage {
    event: "userJoined" | "userLeft" | "message" | "error" | "code" | "userSubmit" | "userSubmitResult";
    username?: string;
    message?: string;
    code?: string; // Used on code messages
    language?: string; // Used on code messages 
}