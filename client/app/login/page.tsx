"use client";

import { Button, Flex, Heading, Input } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { SERVER_URL } from "../../constants";

export default function Login() {
    // on click of the button, redirect to the github login page
    const router = useRouter();

    async function loginWithGithub() {
        const response = await fetch(`${SERVER_URL}/api/v1/login`, {
            mode: "cors",
            credentials: "include",
            method: "POST",
            next: {
                revalidate: 0,
            },
        });

        const data = await response.json();
        const url = data.url;
        router.push(url);
    }

    return (
        <Flex height="100vh" alignItems="center" justifyContent="center">
            <Flex direction="column" background="gray.100" p={20}>
                <Heading textAlign="center" mb={6}>
                    {" "}
                    Login{" "}
                </Heading>
                <Input type="email" placeholder="Email" mb={6} />
                <Input type="password" placeholder="Password" mb={6} />
                <Button variant="outline" onClick={loginWithGithub}>
                    {" "}
                    Login with GitHub{" "}
                </Button>
            </Flex>
        </Flex>
    );
}
