import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { redis } from "../db/redis";
import { domainTable } from "../db/schema";
import { jwtMiddleware } from "../middleware/auth";

export const statsRouter = new Hono<{ Variables: { user: any } }>();

// Helper function to get ISO week number
function getISOWeek(date: Date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}

// Internal endpoint called by Nginx safely
statsRouter.all("/increment", async (c) => {
  const host = c.req.header("Host");
  if (!host) {
    return c.json({ error: "Missing Host header" }, 400);
  }

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const week = String(getISOWeek(now)).padStart(2, "0");

  const totalKey = `${host}:total`;
  const yearlyKey = `${host}:${year}`;
  const monthlyKey = `${host}:${year}-${month}`;
  const weeklyKey = `${host}:${year}-W${week}`;
  const dailyKey = `${host}:${year}-${month}-${day}`;

  const pipeline = redis.pipeline();
  pipeline.incr(totalKey);
  pipeline.incr(yearlyKey);
  pipeline.incr(monthlyKey);
  pipeline.incr(weeklyKey);
  pipeline.incr(dailyKey);

  await pipeline.exec();

  // Handle expirations for Daily and Weekly keys (if not set)
  // End of current day
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // End of current week (assuming Sunday is end of week)
  const currentDayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
  const daysUntilSunday = 7 - currentDayOfWeek;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);

  // Set TTLs if the key is newly created or just update to make sure it drops
  // To avoid resetting TTL on every request, we can use set with EX & NX?
  // But INCR followed by EXPIRE works, though EXPIRE resets TTL.
  // GT/NX options for EXPIRE exist in Redis 7 (e.g. redis.expire(key, seconds, 'NX'))
  // ioredis supports expire with options in newer versions, or we can just ignore resetting and use a simple script.
  // Actually, wait: we can just use `expireat` with the exact timestamp!
  // It won't hurt to update it to the exact same sunset time.
  redis.expireat(dailyKey, Math.floor(endOfDay.getTime() / 1000));
  redis.expireat(weeklyKey, Math.floor(endOfWeek.getTime() / 1000));

  return c.text("ok");
});

statsRouter.use("*", jwtMiddleware);

// Get stats for a specific domain
statsRouter.get("/:domainId", async (c) => {
  const user = c.get("user");
  const domainId = parseInt(c.req.param("domainId"), 10);
  const requestedYear = c.req.query("year");

  // Fetch domain from DB to verify ownership and get subdomain
  const domain = await db
    .select()
    .from(domainTable)
    .where(eq(domainTable.id, domainId));
  if (domain.length === 0)
    return c.json({ error: "Domain not found" }, 404);

  if (domain[0]?.userId !== user.id && !user.isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // domains.ts saves the full subdomain (e.g. sub.domainak.com) into the subdomain field.
  const host = domain[0]?.subdomain;

  const now = new Date();
  const year = requestedYear || now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const week = String(getISOWeek(now)).padStart(2, "0");

  const totalKey = `${host}:total`;

  // If no year was requested, default to the current month's and week's stats.
  // Actually, if a specific year is requested, we shouldn't show the current daily/weekly
  // unless we specify it. But the frontend can just ignore what it doesn't need.
  const monthlyKey = `${host}:${year}-${month}`;
  const weeklyKey = `${host}:${year}-W${week}`;
  const dailyKey = `${host}:${year}-${month}-${day}`;

  const [totalRes, monthlyRes, weeklyRes, dailyRes] = await Promise.all([
    redis.get(totalKey),
    redis.get(monthlyKey),
    redis.get(weeklyKey),
    redis.get(dailyKey),
  ]);

  const daily = parseInt(dailyRes || "0", 10);
  const weekly = parseInt(weeklyRes || "0", 10);
  const monthly = parseInt(monthlyRes || "0", 10);
  const total = parseInt(totalRes || "0", 10);

  // Fetch all 12 months for the requested year for the chart
  const pipeline = redis.pipeline();
  for (let i = 1; i <= 12; i++) {
    const m = String(i).padStart(2, "0");
    pipeline.get(`${host}:${year}-${m}`);
  }

  const chartDataRaw = await pipeline.exec();
  const chartData =
    chartDataRaw?.map((res, index) => ({
      name: new Date(2000, index, 1).toLocaleString("default", {
        month: "short",
      }),
      visitors: parseInt((res[1] as string) || "0", 10),
    })) || [];

  return c.json({
    daily,
    weekly,
    monthly,
    total,
    chartData,
  });
});
