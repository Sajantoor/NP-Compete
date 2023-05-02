import WebSocket from "ws";

declare module "ws" {
    export interface WebSocket {
        roomId: string;
        username: string;
        isAlive: boolean;
    }
}
