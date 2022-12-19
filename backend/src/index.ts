import express from "express";
import dotenv from "dotenv";
import { oAuthCallbackGithub, oAuthWithGithub } from "./authentication";
dotenv.config();

const app = express();
const port = 3000;

app.get("/", (_, res) => {
    res.send("Hello World!");
});

app.get("/login", (_, res) => {
    oAuthWithGithub(res);
});

app.get("/callback", (req, res) => {
    oAuthCallbackGithub(req, res);
});

app.listen(port, () => {
    return console.log("Server is listening on " + port);
});
