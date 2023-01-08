import Router from "next/router";
import { SERVER_URL } from "../constants";


export default function Login() {
    // on click of the button, redirect to the github login page

    async function loginWithGithub() {
        const response = await fetch(`${SERVER_URL}/api/v1/login`, {
            "mode": "cors",
            "credentials": "include",
            "method": "POST",
        });

        const data = await response.json();
        const url = data.url;
        Router.push(url);
    }


    return (
        <>
            <div>
                <h1> Login </h1>
                <button onClick={loginWithGithub}> Login with GitHub </button>
            </div>
        </>
    )
}

