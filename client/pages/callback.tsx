import Router from "next/router";
import { useEffect } from "react";
import { SERVER_URL } from "../constants";

export default function Callback() {
    // TOOD: Fix this as it flashes the error page 
    useEffect(() => {
        makeRequest();
    }, []);

    return (
        <>
            <div>
                <h1> Failed to perform login </h1>
            </div>
        </>
    )
}


async function makeRequest() {
    const callbackURL = window.location.pathname + window.location.search;
    const requestURL = SERVER_URL + "/api/v1" + callbackURL;
    const response = await fetch(requestURL, {
        "credentials": "include",
        "mode": "cors",
    });

    if (response.ok) {
        Router.push("/");
    }
}
