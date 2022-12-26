import { Request, Response } from "express";
import crypto from "crypto";
import agron2 from "argon2";
import redisClient from "./redisClient";
import { badRequest, internalServerError } from "../utilities/errors";

const REDIS_ROOMS_KEY = "rooms";

interface Room {
    name: string;
    size: number;
    uuid: string;
    owner?: string;
    password?: string;
}

export async function getRooms(res: Response) {
    const rooms: string[] = await redisClient.v4.sMembers(REDIS_ROOMS_KEY);

    // The rooms were json stringified when added to redis, so we need to parse them
    // before sending them back to the client, DO NOT send the password to the client.
    const parsedRooms = rooms.map((room: string) => {
        const parsedRoom = JSON.parse(room);
        delete parsedRoom.password;
        return parsedRoom;
    });

    res.json(parsedRooms)
}

export async function createRoom(req: Request, res: Response) {
    let room: Room = req.body as Room;

    if (!validateRoom(room)) {
        return badRequest(res, "Invalid room data");
    }

    const uuid = crypto.randomUUID();
    room = { ...room, uuid };
    room = { ...room, owner: req.session.userId, uuid: uuid };

    if (room.password) {
        const hashedPassword = await agron2.hash(room.password);
        room.password = hashedPassword;
    }

    // TOOD: Change this to use a hash or use JSON instead of using a string
    const addToRedis: number = await redisClient.v4.sAdd(
        REDIS_ROOMS_KEY,
        JSON.stringify(room)
    );

    if (addToRedis === 0) {
        return internalServerError(res, "Failed to create room");
    }

    // Don't send the password to the client
    delete room.password;
    res.status(201).json(room);
}

export async function getRoom(roomUuid: string): Promise<Room | null> {
    const rooms: string[] = await redisClient.v4.sMembers(REDIS_ROOMS_KEY);
    const parsedRooms = rooms.map((room: string) => JSON.parse(room));

    for (const room of parsedRooms) {
        if (room.uuid === roomUuid) return room;
    }

    return null;
}

function validateRoom(room: Room) {
    const MAX_LENGTH = 20;
    const MAX_ROOM_SIZE = 10;

    if (!room.name || room.size <= 0) return false;

    if (room.password && room.password.length < 6) return false;

    if (room.name.length > MAX_LENGTH) return false;

    if (room.password && room.password.length > MAX_LENGTH) return false;

    if (room.size > MAX_ROOM_SIZE) return false;

    return true;
}
