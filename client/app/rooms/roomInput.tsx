"use client";

import { Button, Flex, Heading, Input } from "@chakra-ui/react";
import { useState } from "react";
import { SERVER_URL } from "../../constants";
import { useRouter } from "next/navigation";

interface RoomInput {
    name: string;
    size: number;
    password: string | null;
}

export default function RoomInput() {
    const [roomInput, setRoomInput] = useState<RoomInput>({
        name: "",
        size: 0,
        password: null,
    });

    const Router = useRouter();

    async function createRoom() {
        let roomBody = roomInput;
        if (roomBody.password === "") {
            roomBody = {
                ...roomBody,
                password: null,
            };
        }

        const response = await fetch(`${SERVER_URL}/api/v1/rooms`, {
            method: "POST",
            credentials: "include",
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(roomInput),
        });

        const data = await response.json();

        if (response.ok) {
            Router.push(`/rooms/${data.uuid}`);
        }

        // TODO: handle error
    }

    return (
        <Flex direction="column" padding={10} maxW="50%">
            <Heading m={5}> Or create a room! </Heading>
            <Input
                m={1}
                type="text"
                placeholder="Room Name"
                onChange={(e) =>
                    setRoomInput({
                        ...roomInput,
                        name: e.target.value,
                    })
                }
            />
            <Input
                m={1}
                type="number"
                placeholder="Room Size"
                onChange={(e) =>
                    setRoomInput({
                        ...roomInput,
                        size: parseInt(e.target.value),
                    })
                }
            />
            <Input
                m={1}
                type="password"
                placeholder="Room Password"
                onChange={(e) =>
                    setRoomInput({
                        ...roomInput,
                        password: e.target.value,
                    })
                }
            />
            <Button m={5} variant="outline" onClick={createRoom}>
                {" "}
                Create Room{" "}
            </Button>
        </Flex>
    );
}
