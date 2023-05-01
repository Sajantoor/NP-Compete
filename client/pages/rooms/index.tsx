import { SERVER_URL } from "../../constants";
import { GetStaticProps } from "next";
import Router from "next/router";
import Link from "next/link";
import { useState } from "react";
import { Room } from "../../types/Room";
import { Button, Flex, Heading, Input, Stack, Text } from "@chakra-ui/react";
import NavBar from "../../components/navBar";

interface RoomInput {
    name: string,
    size: number,
    password: string | null,
}

export default function Rooms({ rooms }: { rooms: Room[] }) {

    const [roomInput, setRoomInput] = useState<RoomInput>({
        name: "",
        size: 0,
        password: null,

    });

    async function createRoom() {
        let roomBody = roomInput;
        if (roomBody.password === "") {
            roomBody = {
                ...roomBody,
                password: null,
            }
        }

        const response = await fetch(`${SERVER_URL}/api/v1/rooms`, {
            "method": "POST",
            "credentials": "include",
            "mode": "cors",
            "headers": {
                "Content-Type": "application/json",
            },
            "body": JSON.stringify(roomInput),
        });

        const data = await response.json();
        console.log(data);

        if (response.ok) {
            Router.push(`/rooms/${data.uuid}`);
        }

        return null;
    }

    return (
        <>
            <NavBar />
            <Flex direction="column" p={10} >
                <Flex direction="column" mb={5}>
                    <Heading> Join a room! </Heading>
                </Flex>

                <Stack spacing={3} mb={10}>
                    {rooms.map(
                        (room, index) => {
                            const roomLink = `/rooms/${room.uuid}`
                            return (
                                <Flex key={room.uuid + index} bg="gray.700" padding={3}>
                                    <Link key={room.uuid} href={roomLink}>
                                        <Heading key={index} fontSize="s" fontWeight="normal"> Name: {room.name} Owner: {room.owner} Members: {room.members.length}/{room.size} </Heading>
                                    </Link>
                                </Flex>
                            )
                        }
                    )}
                </Stack>

                <Flex direction="column" mb={5} width="100%" alignItems="center" justifyContent="center">
                    <Flex direction="column" padding={10} maxW="50%" >
                        <Heading m={5}> Or create a room! </Heading>
                        <Input m={1} type="text" placeholder="Room Name" onChange={(e) => setRoomInput({ ...roomInput, name: e.target.value })} />
                        <Input m={1} type="number" placeholder="Room Size" onChange={(e) => setRoomInput({ ...roomInput, size: parseInt(e.target.value) })} />
                        <Input m={1} type="password" placeholder="Room Password" onChange={(e) => setRoomInput({ ...roomInput, password: e.target.value })} />
                        <Button m={5} variant="outline" onClick={createRoom}> Create Room </Button>
                    </Flex>
                </Flex>

            </Flex>
        </>
    )
}

async function fetchRooms() {
    const response = await fetch(`${SERVER_URL}/api/v1/rooms`);
    if (!response.ok) return null;
    return await response.json();
}

export const getStaticProps: GetStaticProps = async () => {
    const rooms = await fetchRooms();

    console.log(rooms);

    return {
        props: {
            rooms,
        },
        revalidate: 10,
    }
}