import { Request, Response } from "express";
import crypto from "crypto";
import agron2 from "argon2";
import { badRequestError, internalServerError } from "../utilities/errors";
import { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { RedisCache } from "../components/redis";
import { ErrorResponse, QuestionMetadata, QuestionResult, Room, SubmissionResult } from "../types/Room";
import { sendError } from "../components/websocket";
import { LEETCODE_API } from "../utilities/constants";
import { WebSocketMessage } from "../types/WebSocketMessage";

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
    const room = await getRoomByUuid(roomUuid);
    if (!room) {
        return badRequestError(res, "Room does not exist");
    }

    res.json(room);
}

/**
 * Gets a room by uuid from the redis cache if it exists, otherwise returns null. 
 * Removes the password from the room before returning it.
 * 
 * @param uuid Room uuid to get from redis cache
 * @returns 
 */
export async function getRoomByUuid(uuid: string): Promise<Room | null> {
    const room = await RedisCache.getRoomByUuid(uuid);

    if (!room) {
        return null;
    }

    // Don't send the password to the client
    delete room.password;
    return room;
}

async function getRoomQuestion(): Promise<QuestionResult | ErrorResponse> {
    const response = await fetch(`${LEETCODE_API}/api/v1/leetcode/questions/random`);
    if (!response.ok) {
        return { message: "Failed to get question" };
    }

    const data = await response.json();

    if (data.status === "error") {
        return { message: data.message };
    }

    return data;
}

/**
 * Creates a room and adds it to the redis cache.
 */
export async function createRoom(req: Request, res: Response) {
    let room = req.body as Room;

    if (!validateInputtedRoom(room)) {
        // TODO: send a better error message here
        return badRequestError(res, "Invalid room data");
    }

    const uuid = crypto.randomUUID();
    room = { ...room, owner: req.session.username, uuid: uuid, members: [] };

    if (room.password) {
        const hashedPassword = await agron2.hash(room.password);
        room.password = hashedPassword;
    }

    const questionResult = await getRoomQuestion();

    // if questionData is of type ErrorResponse, return an error
    if ((questionResult as ErrorResponse).message) {
        const error = questionResult as ErrorResponse;
        return badRequestError(res, error.message);
    }

    // Get the question ID and title from the question result
    const questionData = questionResult as QuestionResult;
    const selectedQuestion: QuestionMetadata = {
        questionID: questionData.id,
        questionTitle: questionData.titleSlug,
    }

    room = { ...room, questionData: selectedQuestion };

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

    if (room.owner !== req.session.username) {
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

    // Take the new room data and merge it with the old room data
    const updatedRoom = { ...room, ...newRoomData };
    await RedisCache.updateRoom(updatedRoom);

    // DO NOT send password to the client
    delete updatedRoom.password;
    res.json(updatedRoom).status(200);
}

export async function addRoomMember(roomUuid: string, username: string): Promise<number> {
    const room = await RedisCache.getRoomByUuid(roomUuid);
    if (!room) return 0;

    room.members.push(username);
    return await RedisCache.updateRoom(room);
}

export async function removeRoomMember(roomUuid: string, username: string): Promise<number> {
    const room = await RedisCache.getRoomByUuid(roomUuid);
    if (!room) return 0;

    // if the last member leaves the room, delete the room
    if (room.members.length === 1) {
        return await RedisCache.removeRoomByUuid(roomUuid);
    }

    room.members = room.members.filter(member => member !== username);
    return await RedisCache.updateRoom(room);
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

    // if the user is already in a room, don't let them join another room
    if (webSocket.roomId) {
        sendError(webSocket, "You are already in a room");
        webSocket.close();
        return false;
    }

    if (!roomUuid) {
        sendError(webSocket, "Room uuid is required");
        webSocket.close();
        return false;
    }

    const room = await RedisCache.getRoomByUuid(roomUuid);

    if (!room) {
        sendError(webSocket, "Room does not exist");
        webSocket.close();
        return false;
    }

    if (room.password) {
        const hashedPassword = req.headers["password"];
        if (!hashedPassword || typeof hashedPassword !== "string") {
            sendError(webSocket, "Password is required to join this room");
            webSocket.close();
            return false;
        }

        const isCorrectPassword = await agron2.verify(room.password, hashedPassword);

        if (!isCorrectPassword) {
            sendError(webSocket, "Incorrect password");
            webSocket.close();
            return false;
        }
    }

    if (room.members.length >= room.size) {
        sendError(webSocket, "Room is full")
        webSocket.close();
        return false;
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

async function getSubmissionResult(submissionId: string): Promise<SubmissionResult> {
    const requestURL = `${LEETCODE_API}/api/v1/leetcode/questions/submissions/${submissionId}`;
    const response = await fetch(requestURL);
    const submissionResult = await response.json();
    return submissionResult as SubmissionResult;
}

export async function handleSubmit(submitMessage: WebSocketMessage, roomId: string): Promise<WebSocketMessage | null> {
    if (submitMessage.event !== "userSubmit") return null;

    const username = submitMessage.username;
    const code = submitMessage.code;
    const language = submitMessage.language;

    // get current question id from room 
    const room = await getRoomByUuid(roomId);
    if (!room == null) {
        // TODO: Send some error here 
        return null;
    }

    const questionId = room?.questionData?.questionID;
    const questionName = room?.questionData?.questionTitle;

    const requestURL = `${LEETCODE_API}/api/v1/leetcode/questions/${questionName}/submit`;
    const requestBody = {
        question_id: questionId,
        lang: language,
        typed_code: code,
    }

    const response = await fetch(requestURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    const submissionId = result.submission_id;

    const submissionResult = await getSubmissionResult(submissionId);
    const submissionState = submissionResult.state;

    const submissionMessage: WebSocketMessage = {
        event: "userSubmitResult",
        username: username,
        message: "Submission result: " + submissionState,
    };

    return submissionMessage;
}