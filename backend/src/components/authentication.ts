import axios from "axios";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import redisClient from "./redisClient";

const STATE_CACHE_KEY = "state_cache";

/**
 * Redirects to Github OAuth, inits OAuth process with a code.
 */
export async function initOAuthWithGithub(req: Request, res: Response) {
    // Check if the user is logged in already
    if (checkIfAuth(req)) {
        res.send("You are logged in...");
        return;
    }

    const state = crypto.randomUUID();
    await redisClient.sAdd(STATE_CACHE_KEY, state);
    // store the state in cache
    const GITHUB_OAUTH = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&state=${state}`;
    res.redirect(GITHUB_OAUTH);
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
        res.status(500).send("Failed to perform OAuth");
        return;
    }

    const hasState = await redisClient.v4.sIsMember(STATE_CACHE_KEY, state);

    if (!hasState) {
        res.status(500).send("Failed to perform OAuth");
        return;
    }

    redisClient.v4.sRem(STATE_CACHE_KEY, state);

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
        res.status(500).send("Failed to perform OAuth");
        return;
    }

    const userInfo = await getUserInfoFromGitHub(bearerToken);

    if (userInfo.status != 200) {
        res.status(500).send("Failed to perform OAuth");
        return;
    }
    // set session
    req.session.userId = userInfo.data["id"];
    res.send(userInfo.data);
}


export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!checkIfAuth(req)) {
        res.status(401).send("Unauthorized");
        return;
    }

    next();
}

function checkIfAuth(req: Request): boolean {
    return req.session.userId !== undefined;
}