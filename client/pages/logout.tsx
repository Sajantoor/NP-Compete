import Router from "next/router";
import { useEffect } from "react";
import { SERVER_URL } from "../constants";

export default function Logout() {
    // TOOD: Fix this as it flashes the error page 
    useEffect(() => {
        makeRequest();
    }, []);

    return (
        <>
            <div>
                <h1> Failed to logout </h1>
            </div>
        </>
    )
}


async function makeRequest() {
    const requestURL = SERVER_URL + "/api/v1/logout";
    const response = await fetch(requestURL, {
        "credentials": "include",
        "mode": "cors",
    });

    if (response.ok) {
        Router.push("/");
    }
}
