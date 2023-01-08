import Router from "next/router"
import { useEffect } from "react";

export default function Room() {
    useEffect(() => {
        const { uuid } = Router.query;
        if (!uuid) {
            return;
        }
        // create new websocket connection
        const websocket = new WebSocket(`ws://localhost:4000/${uuid}`);
        websocket.onopen = () => {
            console.log("connected");
        }

        websocket.onmessage = (event) => {
            console.log(event.data);
        }

        websocket.onclose = () => {
            console.log("disconnected");
        }
    });


    return (
        <>
            <h1> Room with uuid </h1>
        </>
    )
}
