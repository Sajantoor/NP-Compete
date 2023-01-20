import { Response } from "express";

export function internalServerError(res: Response, msg?: string) {
    let message = "Internal Server Error";
    if (msg) {
        message += ": " + msg;
    }
    res.status(500).json({ "error": message });
}

export function badRequestError(res: Response, msg?: string) {
    let message = "Bad Request";
    if (msg) {
        message += ": " + msg;
    }

    res.status(400).json({ "error": message });
}

export function unauthorizedError(res: Response, msg?: string) {
    let message = "Unauthorized";
    if (msg) {
        message += ": " + msg;
    }

    res.status(401).json({ "error": message });
}
