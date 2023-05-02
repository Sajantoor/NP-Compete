import { Request } from "express";
import User from "../entities/User";

export async function createUser(username: string): Promise<User> {
    const user = new User();
    const existingUsername = await User.findOne({ where: { username } });

    if (existingUsername) {
        throw new Error("User already exists");
    }

    user.username = username;
    await user.save();
    return user;
}

export async function getCurrentUser(req: Request): Promise<User | null> {
    return await User.findOne({ where: { username: req.session.username } });
}

export async function getUserByUsername(username: string): Promise<User | null> {
    return await User.findOne({ where: { username } });
}

export async function getUserById(username: string): Promise<User | null> {
    return await User.findOne({ where: { username: username } });
}
