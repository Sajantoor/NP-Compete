import axios from "axios";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { badRequestError, internalServerError, unauthorizedError } from "../utilities/errors";
import { RedisCache } from "../components/redis";
import { createUser, getCurrentUser, getUserByUsername } from "../components/users";
import { COOKIE_NAME } from "../utilities/constants";

/**
 * Redirects to Github OAuth, inits OAuth process with a code.
 */
export async function initOAuthWithGithub(req: Request, res: Response) {
    // Check if the user is logged in already
    if (checkIfAuth(req)) {
        return badRequestError(res, "User is already logged in");
    }

    const state = crypto.randomUUID();
    // store the state in cache
    await RedisCache.addState(state);
    const GITHUB_OAUTH = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&state=${state}`;
    res.json({ "url": GITHUB_OAUTH });
}

async function getUserInfoFromGitHub(bearerToken: string) {
    const GITHUB_USER_ENDPOINT = "https://api.github.com/user";
    const request = axios({
        url: GITHUB_USER_ENDPOINT,
        method: "get",
        headers: {
            Authorization: `Bearer ${bearerToken}`,
            "accept-encoding": null,
        },
    });

    return request;
}

/**
 * OAuth call back for Github OAuth. If successful sends the user's info from GitHub
 * else returns an error.
 */
export async function oAuthCallbackGithub(req: Request, res: Response) {
    // Check if state matches the one we sent
    // if it does, then we can exchange the code for an access token, otherwise throw an error.
    const state = req.query.state as string;
    if (!state) {
        return internalServerError(res, "Failed to perform OAuth");
    }

    const hasState = await RedisCache.hasState(state);

    if (!hasState) {
        return internalServerError(res, "Failed to perform OAuth");
    }

    RedisCache.removeState(state);

    const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
    const data = {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: req.query.code,
    };

    const tokenRequest = await axios({
        method: "post",
        url: GITHUB_ACCESS_TOKEN_URL,
        data,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "accept-encoding": null,
        },
    });

    const bearerToken = tokenRequest.data["access_token"];

    if (!bearerToken) {
        return internalServerError(res, "Failed to perform OAuth");
    }

    const userInfo = await getUserInfoFromGitHub(bearerToken);

    if (userInfo.status != 200) {
        return internalServerError(res, "Failed to perform OAuth");
    }

    // If this user exists in the database, then we can just log them in
    // otherwise we need to create a new user in the database.
    const userName = userInfo.data["login"];
    const userExists = await getUserByUsername(userName);
    let username: string;

    if (!userExists) {
        const user = await createUser(userName);
        username = user.username;
    } else {
        username = userExists.username;
    }

    // set session
    req.session.username = username;
    res.json({ "user": userInfo.data });
}

export async function getProfile(req: Request, res: Response) {
    const user = await getCurrentUser(req);
    console.log(user);

    if (!user) {
        return unauthorizedError(res);
    }

    // TOOD: hide the user id from the client 
    res.json({ "user": user });
}


/**
 * Middleware to check if the user is logged in.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!checkIfAuth(req)) {
        return unauthorizedError(res);
    }

    next();
}

/**
 * Checks if the user is logged in.
 * @returns Returns true if the user is logged in, false otherwise.
 */
function checkIfAuth(req: Request): boolean {
    return req.session.username !== undefined;
}

export function logout(req: Request, res: Response) {
    req.session.destroy((err) => {
        if (err) console.error(err);
    });

    res.clearCookie(COOKIE_NAME);
    res.json({ "message": "Logged out" });
}
