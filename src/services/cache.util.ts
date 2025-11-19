import NodeCache from "node-cache";
import crypto from "crypto";

export const cache = new NodeCache({
  stdTTL: 60, // default TTL
  checkperiod: 120, // cleanup
});

// Create consistent cache keys
export const makeCacheKey = (prefix: string, obj: any) =>
  `${prefix}:${crypto
    .createHash("md5")
    .update(JSON.stringify(obj))
    .digest("hex")}`;

export const cacheGet = async (key: string) => {
  return cache.get(key) || null;
};

export const cacheSet = async (key: string, value: any, ttlSeconds = 60) => {
  cache.set(key, value, ttlSeconds);
};

export const acquireLock = async (lockKey: string, ttlMs = 5000) => {
  if (cache.get(lockKey)) return null; // lock exists
  const token = crypto.randomBytes(16).toString("hex");
  cache.set(lockKey, token, ttlMs / 1000);
  return token;
};

export const releaseLock = async (lockKey: string, token: string) => {
  const stored = cache.get(lockKey);
  if (stored === token) {
    cache.del(lockKey);
  }
};
