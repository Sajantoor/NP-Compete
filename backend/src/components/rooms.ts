import { Request, Response } from "express";
import redisClient from "./redisClient";
import crypto from "crypto";

const REDIS_ROOMS_KEY = "rooms";

interface Room {
    name: string;
    size: number;
    uuid: string;
    password?: string;
}

export async function getRooms(req: Request, res: Response) {
    const rooms: string[] = await redisClient.v4.sMembers(REDIS_ROOMS_KEY);

    // The rooms were json stringified when added to redis, so we need to parse them
    // before sending them back to the client.
    res.send(rooms.map((room: string) => JSON.parse(room)));
}

export async function createRoom(req: Request, res: Response) {
    let room: Room = req.body as Room;

    // if any fields are missing, return 400,
    // TODO: Add more validation
    if (!validateRoom(room)) {
        res.status(400).send("Bad Request: Invalid room data");
        return;
    }


    const uuid = crypto.randomUUID();
    room = { ...room, uuid };
    // set room owner as the user who created the room
    // room = { ...room, owner: req.session.userId, uuid: uuid };

    // add to redis, this is going to be a list or set of rooms
    const addToRedis: number = await redisClient.v4.sAdd(
        REDIS_ROOMS_KEY,
        JSON.stringify(room)
    );

    if (addToRedis === 0) {
        res.status(500).send("Server Error: Could not create room");
        return;
    }

    res.status(201).send(room);
}


function validateRoom(room: Room) {
    const MAX_LENGTH = 20;
    const MAX_ROOM_SIZE = 10;

    if (!room.name || room.size <= 0)
        return false;

    // if it has a password, it must be at least 6 characters
    if (room.password && room.password.length < 6)
        return false;

    // name and password must be alphanumeric
    if (!/^[a-zA-Z0-9]+$/.test(room.name))
        return false;

    if (room.password && !/^[a-zA-Z0-9]+$/.test(room.password))
        return false;

    // name must be less than 20 characters
    if (room.name.length > MAX_LENGTH)
        return false;


    // password must be less than 20 characters
    if (room.password && room.password.length > MAX_LENGTH)
        return false;

    if (room.size > MAX_ROOM_SIZE)
        return false;


    return true;
}