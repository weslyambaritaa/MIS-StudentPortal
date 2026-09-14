import { createClient } from "redis";
import { env } from "../config/env";

export const redisClient = createClient({ url: env.redisUrl });

export async function connectRedisIfEnabled() {
  if (!env.cacheEnabled || redisClient.isOpen) return;
  redisClient.on("error", (error) => console.error("Redis error", error));
  await redisClient.connect();
}
