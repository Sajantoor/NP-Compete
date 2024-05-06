import { SERVER_URL } from "../../constants";
import Link from "next/link";
import { Room } from "../../../server/src/types/Room";
import { Flex, Heading, Stack } from "@chakra-ui/react";
import NavBar from "../components/navBar";
import RoomInput from "./roomInput";

interface RoomInput {
    name: string;
    size: number;
    password: string | null;
}

export default async function Rooms() {
    const rooms = (await fetchRooms()) || [];

    return (
        <>
            <NavBar />
            <Flex direction="column" p={10}>
                <Flex direction="column" mb={5}>
                    <Heading> Join a room! </Heading>
                </Flex>

                <Stack spacing={3} mb={10}>
                    {rooms.map((room, index) => {
                        const roomLink = `/rooms/${room.uuid}`;
                        return (
                            <Flex
                                key={room.uuid + index}
                                bg="gray.200"
                                padding={3}
                            >
                                <Link key={room.uuid} href={roomLink}>
                                    <Heading
                                        key={index}
                                        fontSize="s"
                                        fontWeight="normal"
                                    >
                                        {" "}
                                        Name: {room.name} Owner: {room.owner}{" "}
                                        Members: {room.members.length}/
                                        {room.size}{" "}
                                    </Heading>
                                </Link>
                            </Flex>
                        );
                    })}
                </Stack>

                <Flex
                    direction="column"
                    mb={5}
                    width="100%"
                    alignItems="center"
                    justifyContent="center"
                >
                    <RoomInput />
                </Flex>
            </Flex>
        </>
    );
}

async function fetchRooms() {
    const response = await fetch(`${SERVER_URL}/api/v1/rooms`, {
        next: {
            revalidate: 10,
        },
    });
    if (!response.ok) return null;
    return (await response.json()) as Room[];
}
