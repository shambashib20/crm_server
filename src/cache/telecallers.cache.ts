import { LRUCache } from "lru-cache";

export const teleCallersCache = new LRUCache<string, any[]>({
  max: 200,
  ttl: 1000 * 30,
  allowStale: false,
});
