import { SERVER_URL } from "../../constants";
import { GetStaticProps } from "next";
import Router from "next/router";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Room } from "../../types/Room";

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
            <h1> Rooms </h1>
            <ul>
                {rooms.map(
                    (room, index) => {
                        const roomLink = `/rooms/${room.uuid}`
                        return (
                            <Fragment key={room.uuid + index}>
                                <li key={index}> name: {room.name} owner: {room.owner} members: {room.members.length}/{room.size} </li>
                                <Link key={room.uuid} href={roomLink} > Link </Link>
                            </Fragment>
                        )
                    }
                )}
            </ul>

            {/* Add input for the fields of rooms */}
            <input type="text" placeholder="Room Name" onChange={(e) => setRoomInput({ ...roomInput, name: e.target.value })} />
            <input type="number" placeholder="Room Size" onChange={(e) => setRoomInput({ ...roomInput, size: parseInt(e.target.value) })} />
            <input type="password" placeholder="Room Password" onChange={(e) => setRoomInput({ ...roomInput, password: e.target.value })} />
            <button onClick={createRoom}> Create Room </button>
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