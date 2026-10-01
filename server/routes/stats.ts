import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { redis } from "../db/redis";
import { domainTable } from "../db/schema";
import { jwtMiddleware } from "../middleware/auth";

export const statsRouter = new Hono<{ Variables: { user: any } }>();

// Returns the ISO week-numbering year and week for a date. The ISO year can
// differ from the calendar year for days near January 1st, and the proxy
// writes its weekly counter with `os.date("!%G-W%V")` (UTC, ISO year).
function getISOWeekYear(date: Date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week };
}

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
  // All counter keys are written by the proxy in UTC, so read them in UTC too.
  const year = requestedYear || now.getUTCFullYear().toString();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const isoWeek = getISOWeekYear(now);
  const week = String(isoWeek.week).padStart(2, "0");

  const totalKey = `${host}:total`;

  // If no year was requested, default to the current month's and week's stats.
  // Actually, if a specific year is requested, we shouldn't show the current daily/weekly
  // unless we specify it. But the frontend can just ignore what it doesn't need.
  const monthlyKey = `${host}:${year}-${month}`;
  const weeklyKey = `${host}:${isoWeek.year}-W${week}`;
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
