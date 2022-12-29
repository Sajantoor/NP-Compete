import { createClient } from "redis";
import { Room } from "../types/Room";

const redisClient = createClient({ legacyMode: true });
redisClient.connect().catch(console.error);

const STATE_CACHE_KEY = "state_cache";
const REDIS_ROOMS_KEY = "rooms";


class RedisCache {
    static async addState(state: string): Promise<number> {
        return redisClient.v4.sAdd(STATE_CACHE_KEY, state);
    }

    static async hasState(state: string): Promise<boolean> {
        return redisClient.v4.sIsMember(STATE_CACHE_KEY, state);
    }

    static async removeState(state: string): Promise<number> {
        return redisClient.v4.sRem(STATE_CACHE_KEY, state);
    }

    static async getRooms(): Promise<Room[]> {
        const rooms = await redisClient.v4.sMembers(REDIS_ROOMS_KEY);
        const parsedRooms = rooms.map((room: string) => JSON.parse(room));
        return parsedRooms;
    }

    static async addRoom(room: Room): Promise<number> {
        return redisClient.v4.sAdd(REDIS_ROOMS_KEY, JSON.stringify(room));
    }

    static async getRoomByUuid(uuid: string): Promise<Room | null> {
        const rooms = await this.getRooms();

        for (const room of rooms) {
            if (room.uuid === uuid) return room;
        }

        return null;
    }

    static async removeRoomByUuid(uuid: string): Promise<number> {
        const room = await this.getRoomByUuid(uuid);
        if (room) {
            return await redisClient.v4.sRem(REDIS_ROOMS_KEY, JSON.stringify(room));
        }
        return 0;
    }

    static async updateRoom(room: Room): Promise<number> {
        const uuid = room.uuid;
        await this.removeRoomByUuid(uuid);
        return await this.addRoom(room);
    }

    static async addRoomMember(roomUuid: string, userId: string): Promise<number> {
        const room = await this.getRoomByUuid(roomUuid);
        if (room) {
            room.members.push(userId);
            return await this.updateRoom(room);
        }
        return 0;
    }

    static async removeRoomMember(roomUuid: string, userId: string): Promise<number> {
        const room = await this.getRoomByUuid(roomUuid);
        if (room) {
            room.members = room.members.filter(member => member !== userId);
            return await this.updateRoom(room);
        }
        return 0;
    }
}

export { RedisCache, redisClient };