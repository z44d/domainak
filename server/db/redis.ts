import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = new Redis(redisUrl);

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis for stats tracking.");
});

// Removes the routing entry plus every analytics counter that belongs to a
// subdomain (`host:total`, `host:YYYY`, `host:YYYY-MM`, `host:YYYY-Www`,
// `host:YYYY-MM-DD`). The total/year/month counters have no TTL, so they
// must be cleaned up explicitly when a route disappears.
export async function deleteDomainRoute(subdomain: string) {
  await redis.del(subdomain);

  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${subdomain}:*`,
      "COUNT",
      200,
    );
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}
