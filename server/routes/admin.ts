import { count, desc, eq, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { db } from "../db";
import { redis } from "../db/redis";
import {
  bannedDomainsTable,
  bannedIpsTable,
  domainTable,
  userTable,
} from "../db/schema";
import { adminMiddleware, jwtMiddleware } from "../middleware/auth";

export const adminRouter = new Hono<{ Variables: { user: any } }>();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPaginationParams(c: Context) {
  const page = parsePositiveInt(c.req.query("page"), 1);
  const requestedPageSize = parsePositiveInt(
    c.req.query("pageSize"),
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function buildPagination(
  totalItems: number,
  page: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    page,
    pageSize,
    total: totalItems,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

async function setBannedDomainCache(domain: string) {
  await redis.set(`banned:${domain}`, "1");
}

async function clearBannedDomainCache(domain: string) {
  await redis.del(`banned:${domain}`);
}

adminRouter.use("*", jwtMiddleware);
adminRouter.use("*", adminMiddleware);

// Get paginated domains
adminRouter.get("/domains", async (c) => {
  const { page, pageSize, offset } = getPaginationParams(c);
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(domainTable);
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
        githubId: userTable.githubId,
        isBanned: userTable.isBanned,
      },
    })
    .from(domainTable)
    .leftJoin(userTable, eq(domainTable.userId, userTable.id))
    .orderBy(desc(domainTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    items: domains,
    pagination: buildPagination(Number(total), page, pageSize),
  });
});

// Get paginated users
adminRouter.get("/users", async (c) => {
  const { page, pageSize, offset } = getPaginationParams(c);
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(userTable);

  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      githubId: userTable.githubId,
      isBanned: userTable.isBanned,
      domainCount: sql<number>`count(${domainTable.id})`,
    })
    .from(userTable)
    .leftJoin(domainTable, eq(domainTable.userId, userTable.id))
    .groupBy(
      userTable.id,
      userTable.name,
      userTable.email,
      userTable.githubId,
      userTable.isBanned,
    )
    .orderBy(desc(userTable.id))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    items: users,
    pagination: buildPagination(Number(total), page, pageSize),
  });
});

// Get paginated banned users
adminRouter.get("/banned-users", async (c) => {
  const { page, pageSize, offset } = getPaginationParams(c);
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(userTable)
    .where(eq(userTable.isBanned, true));

  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      githubId: userTable.githubId,
      isBanned: userTable.isBanned,
      domainCount: sql<number>`count(${domainTable.id})`,
    })
    .from(userTable)
    .leftJoin(domainTable, eq(domainTable.userId, userTable.id))
    .where(eq(userTable.isBanned, true))
    .groupBy(
      userTable.id,
      userTable.name,
      userTable.email,
      userTable.githubId,
      userTable.isBanned,
    )
    .orderBy(desc(userTable.id))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    items: users,
    pagination: buildPagination(Number(total), page, pageSize),
  });
});

// Get paginated banned domains
adminRouter.get("/banned-domains", async (c) => {
  const { page, pageSize, offset } = getPaginationParams(c);
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(bannedDomainsTable);
  const bannedDomains = await db
    .select()
    .from(bannedDomainsTable)
    .orderBy(desc(bannedDomainsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    items: bannedDomains,
    pagination: buildPagination(Number(total), page, pageSize),
  });
});

// Get paginated banned IPs
adminRouter.get("/ips", async (c) => {
  const { page, pageSize, offset } = getPaginationParams(c);
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(bannedIpsTable);
  const bannedIps = await db
    .select()
    .from(bannedIpsTable)
    .orderBy(desc(bannedIpsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    items: bannedIps,
    pagination: buildPagination(Number(total), page, pageSize),
  });
});

// Delete a domain
adminRouter.delete("/domains/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const domain = await db
    .select()
    .from(domainTable)
    .where(eq(domainTable.id, id));
  if (domain.length === 0)
    return c.json({ error: "Domain not found" }, 404);
  await db.delete(domainTable).where(eq(domainTable.id, id));
  const subdomain = domain[0]?.subdomain;
  if (subdomain) await redis.del(subdomain);
  return c.json({ success: true });
});

// Ban a domain
adminRouter.post("/banned-domains", async (c) => {
  const body = await c.req.json();
  const domain = String(body.domain || "")
    .trim()
    .toLowerCase();
  const reason = String(body.reason || "").trim() || null;

  if (!domain) {
    return c.json({ error: "Domain required" }, 400);
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(bannedDomainsTable).values({ domain, reason });
      await tx
        .delete(domainTable)
        .where(eq(domainTable.subdomain, domain));
    });

    await Promise.all([redis.del(domain), setBannedDomainCache(domain)]);
    return c.json({ success: true });
  } catch (error: any) {
    if (error.code === "23505") {
      return c.json({ error: "Domain already banned" }, 400);
    }

    console.error("Failed to ban domain:", error);
    return c.json({ error: "Failed to ban domain" }, 500);
  }
});

// Unban a domain
adminRouter.delete("/banned-domains/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  const existing = await db
    .select()
    .from(bannedDomainsTable)
    .where(eq(bannedDomainsTable.id, id));

  if (existing.length === 0) {
    return c.json({ error: "Banned domain not found" }, 404);
  }

  const bannedDomain = existing[0];
  if (!bannedDomain) {
    return c.json({ error: "Banned domain not found" }, 404);
  }

  await db.delete(bannedDomainsTable).where(eq(bannedDomainsTable.id, id));
  await clearBannedDomainCache(bannedDomain.domain);
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

// Unban an IP
adminRouter.delete("/ips/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  const existing = await db
    .select()
    .from(bannedIpsTable)
    .where(eq(bannedIpsTable.id, id));

  if (existing.length === 0) {
    return c.json({ error: "Blocked IP not found" }, 404);
  }

  await db.delete(bannedIpsTable).where(eq(bannedIpsTable.id, id));
  return c.json({ success: true });
});
