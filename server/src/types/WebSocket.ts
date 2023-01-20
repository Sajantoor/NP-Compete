import WebSocket from "ws";

declare module "ws" {
    export interface WebSocket {
        roomId: string;
        userId: string;
        isAlive: boolean;
    }
}
