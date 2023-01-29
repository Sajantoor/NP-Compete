import axios from "axios";
import { Response } from "express";

const LEETCODE_API_HOST = "https://leetcode.com/api/problems/algorithms/";

export async function getQuestions(res: Response) {
    // To get a question user must be in a room 
    // TODO: Validate the user is in a room 
    // If not in a room return error message

    const request = await axios.get(LEETCODE_API_HOST + "/api/v1/leetcode/questions/random");
    const data = request.data;

    // Send the question to the websocket 

    // user must be in a room to get questions 
    res.status(200).json(data);
}

export async function submitQuestion(res: Response) {

}