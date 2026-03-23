import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { redis } from "server/db/redis";
import { db } from "../db";
import { bannedIpsTable, domainTable } from "../db/schema";
import { jwtMiddleware } from "../middleware/auth";

export const domainsRouter = new Hono<{ Variables: { user: any } }>();
domainsRouter.use("*", jwtMiddleware);

// Get available base domains
domainsRouter.get("/available", async (c) => {
  const availableDomains = process.env.DOMAINS
    ? process.env.DOMAINS.split(" ").filter((d) => d)
    : ["localhost"];
  return c.json({ available: availableDomains });
});

// Get user's domains
domainsRouter.get("/", async (c) => {
  const user = c.get("user");
  const domains = await db
    .select()
    .from(domainTable)
    .where(eq(domainTable.userId, user.id));
  return c.json({ domains });
});

// Add a new subdomain
domainsRouter.post("/", async (c) => {
  const user = c.get("user");
  const { subdomain, domain, hostname, port } = await c.req.json();

  if (!subdomain || !domain || !hostname || !port) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Validate base domain
  const availableDomains = process.env.DOMAINS
    ? process.env.DOMAINS.split(" ")
    : [];
  if (!availableDomains.includes(domain)) {
    return c.json({ error: "Invalid base domain" }, 400);
  }

  const fullSubdomain = `${subdomain}.${domain}`;

  // Check if IP is banned
  const bannedIpCheck = await db
    .select()
    .from(bannedIpsTable)
    .where(eq(bannedIpsTable.ip, hostname));
  if (bannedIpCheck.length > 0) {
    return c.json({ error: "IP Address is banned" }, 403);
  }

  if (await redis.exists(fullSubdomain)) {
    return c.json({ error: "Subdomain already taken" }, 400);
  }

  try {
    await redis.set(fullSubdomain, `${hostname}:${port}`);
    const inserted = await db
      .insert(domainTable)
      .values({
        userId: user.id,
        subdomain: fullSubdomain,
        hostname,
        port: parseInt(port, 10),
      })
      .returning();

    return c.json({ domain: inserted[0] });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: "Failed to register subdomain" }, 500);
  }
});

// Delete a domain
domainsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);

  const domain = await db
    .select()
    .from(domainTable)
    .where(eq(domainTable.id, id));

  if (domain.length === 0)
    return c.json({ error: "Domain not found" }, 404);
  if (domain[0]?.userId !== user.id)
    return c.json({ error: "Forbidden" }, 403);

  await db.delete(domainTable).where(eq(domainTable.id, id));
  const subdomain = domain[0]?.subdomain;
  if (subdomain) await redis.del(subdomain);
  return c.json({ success: true });
});
