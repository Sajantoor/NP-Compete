import Router from "next/router"
import { useEffect, useRef, useState } from "react";

interface WebSocketMessage {
    event: string, // userJoined, userLeft, message, error 
    message?: string // Only appears on error and message events
    userId?: string // Only appears on userJoin, userLeft and message events
}


export default function Room() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [websocket, setWebSocket] = useState<WebSocket | null>(null);

    useEffect(() => {
        const { uuid } = Router.query;
        if (!uuid) {
            return;
        }

        if (!websocket) {
            // create new websocket connection
            setWebSocket(new WebSocket(`ws://localhost:4000/${uuid}`));
        }

        if (!websocket) {
            return;
        }

        // websocket event handlers
        websocket.onopen = () => {
            console.log("connected");
        }

        websocket.onmessage = (event) => {
            processMessage(event.data);
        }

        websocket.onclose = () => {
            Router.push("/rooms");
        }

        // On component unmount, close websocket
        return () => {
            websocket.close();
        }
    }, [websocket]);

    function processMessage(rawMessage: string) {
        const message: WebSocketMessage = JSON.parse(rawMessage);
        console.log(message);

        let newMessage: string | undefined;
        switch (message.event) {

            case "userJoined":
                newMessage = `User ${message.userId} joined`;
                break;
            case "userLeft":
                newMessage = `User ${message.userId} left`;
                break;
            case "error":
                console.error("Error: ", message.message);
                break;
            case "message":
                newMessage = `User ${message.userId}: ${message.message}`;
                break;
            default:
                console.error("Unknown event: ", message.event);
                break;
        }

        if (newMessage) {
            // TODO: I'm not sure why this has to be a function
            setMessages(messages => ([...messages, newMessage!]));
        }
    }

    function sendMessage() {
        const message = inputRef?.current?.value;
        if (!message) {
            return;
        }

        if (!websocket) {
            console.log("No websocket connection");
            return;
        }

        websocket.send(message);
    }

    return (
        <>
            <h1> Room with uuid </h1>
            <h2> Messages </h2>
            <ul>
                {messages.map((message, index) => {
                    return (
                        <li key={index}> {message} </li>
                    )
                })}
            </ul>

            <h2> Send message </h2>
            <input ref={inputRef} type="text" />
            <button onClick={sendMessage}> Send </button>
            <button onClick={() => Router.push("/rooms")}> Leave </button>
        </>
    )
}
