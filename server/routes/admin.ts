import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { bannedIpsTable, domainTable, userTable } from "../db/schema";
import { adminMiddleware, jwtMiddleware } from "../middleware/auth";

export const adminRouter = new Hono<{ Variables: { user: any } }>();

adminRouter.use("*", jwtMiddleware);
adminRouter.use("*", adminMiddleware);

// Get all latest domains
adminRouter.get("/domains", async (c) => {
  const domains = await db
    .select({
      id: domainTable.id,
      subdomain: domainTable.subdomain,
      hostname: domainTable.hostname,
      port: domainTable.port,
      createdAt: domainTable.createdAt,
      user: {
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      },
    })
    .from(domainTable)
    .leftJoin(userTable, eq(domainTable.userId, userTable.id))
    .orderBy(desc(domainTable.createdAt))
    .limit(100);

  return c.json({ domains });
});

// Delete a domain
adminRouter.delete("/domains/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await db.delete(domainTable).where(eq(domainTable.id, id));
  return c.json({ success: true });
});

// Ban/Unban user
adminRouter.post("/users/:id/ban", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const { isBanned } = await c.req.json();

  await db.update(userTable).set({ isBanned }).where(eq(userTable.id, id));

  return c.json({ success: true, isBanned });
});

// Ban an IP
adminRouter.post("/ips/ban", async (c) => {
  const { ip, reason } = await c.req.json();
  if (!ip) return c.json({ error: "IP required" }, 400);

  try {
    await db.insert(bannedIpsTable).values({ ip, reason });
    return c.json({ success: true });
  } catch (error: any) {
    if (error.code === "23505") {
      return c.json({ error: "IP already banned" }, 400);
    }
    return c.json({ error: "Failed to ban IP" }, 500);
  }
});
