import { createClient } from "redis";

const redisClient = createClient({ legacyMode: true });
redisClient.connect().catch(console.error);

export default redisClient;
