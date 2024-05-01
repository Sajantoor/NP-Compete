"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SERVER_URL } from "../../constants";

export default function Logout() {
    const router = useRouter();
    // TOOD: Fix this as it flashes the error page
    useEffect(() => {
        makeRequest();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    async function makeRequest() {
        if (!router) {
            return;
        }

        const requestURL = SERVER_URL + "/api/v1/logout";
        const response = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            mode: "cors",
        });

        if (response.ok) {
            router.push("/");
        }
    }

    return (
        <>
            <div>
                <h1> Failed to logout </h1>
            </div>
        </>
    );
}
