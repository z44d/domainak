import { Hono } from "hono";
import { eq, sql, gte } from "drizzle-orm";
import { jwtMiddleware } from "../middleware/auth";
import { db } from "../db";
import { domainTable, domainVisitsTable } from "../db/schema";

export const statsRouter = new Hono<{ Variables: { user: any } }>();

statsRouter.use("*", jwtMiddleware);

// Get stats for a specific domain
statsRouter.get("/:domainId", async (c) => {
  const user = c.get("user");
  const domainId = parseInt(c.req.param("domainId"));

  // Verify ownership
  const domain = await db.select().from(domainTable).where(eq(domainTable.id, domainId));
  if (domain.length === 0) return c.json({ error: "Domain not found" }, 404);
  
  if (domain[0]!.userId !== user.id && !user.isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  // Fetch all relevant visits
  const visits = await db
    .select()
    .from(domainVisitsTable)
    .where(eq(domainVisitsTable.domainId, domainId));

  let daily = 0;
  let weekly = 0;
  let monthly = 0;

  for (const v of visits) {
    const vDate = new Date(v.date).toISOString().split('T')[0]!;
    if (vDate >= oneDayAgo) daily += v.visitors;
    if (vDate >= oneWeekAgo) weekly += v.visitors;
    if (vDate >= oneMonthAgo) monthly += v.visitors;
  }

  return c.json({
    daily,
    weekly,
    monthly,
    total: monthly // Fallback or compute total
  });
});
