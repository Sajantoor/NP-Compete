import { Request, Response } from "express";
import crypto from "crypto";
import agron2 from "argon2";
import { badRequestError, internalServerError } from "../utilities/errors";
import { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { RedisCache } from "./redis";
import { Room } from "../types/Room";

/**
 * 
 * Gets all the rooms from the redis cache and sends them to the client.
 */
export async function getRooms(res: Response) {
    const rooms = await RedisCache.getRooms();

    // DO NOT send the password to the client.  
    const roomsToSend = rooms.map(room => {
        delete room.password;
        return room;
    });

    res.json(roomsToSend);
}

/**
 * Gets a room by uuid from the redis cache and sends it to the client. 
 */
export async function getRoom(req: Request, res: Response) {
    const roomUuid = req.params.uuid;
    const room = await RedisCache.getRoomByUuid(roomUuid);

    if (!room) {
        return badRequestError(res, "Room does not exist");
    }

    // Don't send the password to the client
    delete room.password;
    res.json(room);
}

/**
 * Creates a room and adds it to the redis cache.
 */
export async function createRoom(req: Request, res: Response) {
    let room = req.body as Room;

    if (!validateInputtedRoom(room)) {
        return badRequestError(res, "Invalid room data");
    }

    const uuid = crypto.randomUUID();
    room = { ...room, owner: req.session.userId, uuid: uuid };

    if (room.password) {
        const hashedPassword = await agron2.hash(room.password);
        room.password = hashedPassword;
    }

    const addToRedis = await RedisCache.addRoom(room);

    if (addToRedis === 0) {
        return internalServerError(res, "Failed to create room");
    }

    // Don't send the password to the client
    delete room.password;
    res.status(201).json(room);
}

/**
 * Updates a room in the redis cache, sends the updated room to the client.
 */
export async function patchRoom(req: Request, res: Response) {
    const roomUuid = req.params.uuid;
    const room = await RedisCache.getRoomByUuid(roomUuid);

    if (!room) {
        return badRequestError(res, "Room does not exist");
    }

    if (room.owner !== req.session.userId) {
        return badRequestError(res, "You are not the owner of this room");
    }

    const newRoomData = req.body as Room;

    if (!validateInputtedRoom(newRoomData)) {
        return badRequestError(res, "Invalid room data");
    }

    if (newRoomData.password) {
        const hashedPassword = await agron2.hash(newRoomData.password);
        newRoomData.password = hashedPassword;
    }

    await RedisCache.updateRoom(newRoomData);

    // DO NOT send password to the client
    delete newRoomData.password;
    res.json(newRoomData).status(200);
}


/**
 * Verify if the user can join the room, if the room has a password the user is 
 * required to send the password in the request headers. Room uuid is required in the 
 * request url.
 * 
 * 
 * @param webSocket WebSocket trying to join the room
 * @param req Request from the WebSocket
 * @returns True if the user can join the room, false if the user cannot join the room
*/
export async function verifyUserCanJoinRoom(webSocket: WebSocket, req: IncomingMessage): Promise<boolean> {
    const roomUuid = req.url?.split("/")[1];

    if (!roomUuid) {
        webSocket.send("Room uuid is missing");
        webSocket.close();
        return false;
    }

    const room = await RedisCache.getRoomByUuid(roomUuid);

    if (!room) {
        webSocket.send("Room does not exist");
        webSocket.close();
        return false;
    }

    // Check if the password is correct
    if (room.password) {
        const hashedPassword = req.headers["password"];
        if (!hashedPassword || typeof hashedPassword !== "string") {
            webSocket.send("Password is missing");
            webSocket.close();
            return false;
        }

        const isCorrectPassword = await agron2.verify(room.password, hashedPassword);

        if (!isCorrectPassword) {
            webSocket.send("Incorrect password for this room...");
            webSocket.close();
            return false;
        }
    }

    return true;
}

/**
 * @param room Room to validate
 * @returns Whether the room is valid or not
 */
function validateInputtedRoom(room: Room) {
    const MAX_LENGTH = 20;
    const MAX_ROOM_SIZE = 10;

    if (!room.name || room.size <= 0) return false;

    if (room.password && room.password.length < 6) return false;

    if (room.name.length > MAX_LENGTH) return false;

    if (room.password && room.password.length > MAX_LENGTH) return false;

    if (room.size > MAX_ROOM_SIZE) return false;

    return true;
}
