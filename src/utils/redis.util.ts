// redis.ts
import Redis from "ioredis";

const redisClient = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: 3,
  connectTimeout: 1000,
  lazyConnect: true,
  retryStrategy: () => null,
});

let silentErrorLogged = false;

redisClient.on("connect", () => {
  console.log("Redis connected");
  silentErrorLogged = false;
});

redisClient.on("error", (err) => {
  if (!silentErrorLogged) {
    console.warn("Redis connection error:", err.message);
    silentErrorLogged = true;
  }
});

export const redis = {
  client: redisClient,
  get silentErrorLogged() {
    return silentErrorLogged;
  },
  set silentErrorLogged(val: boolean) {
    silentErrorLogged = val;
  },
};
