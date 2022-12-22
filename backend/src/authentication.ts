import axios from "axios";
import { Request, Response } from "express";

/**
 * Redirects to Github OAuth, inits OAuth process with a code.
 */
export function initOAuthWithGithub(res: Response) {
    // TODO: This is not safe as Math.random is seeded and this poses a security risk
    // State needs to *really* be a random string
    const STATE = Math.random().toString(36).substring(2, 15);
    const GITHUB_OAUTH = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&state=${STATE}`;
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
    // TODO: check if state matches the one we sent
    // if it does, then we can exchange the code for an access token, otherwise throw an error.
    // Not doing this poses a security risk.
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

    const bearerToken: string = tokenRequest.data["access_token"];
    const userInfo = await getUserInfoFromGitHub(bearerToken);
    res.send(userInfo.data);
}
