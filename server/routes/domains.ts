import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { redis } from "server/db/redis";
import { db } from "../db";
import {
  bannedDomainsTable,
  bannedIpsTable,
  domainTable,
} from "../db/schema";
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
  const { subdomain, domain, hostname, port, targetUrl, mode } =
    await c.req.json();

  const sanitizedSubdomain = String(subdomain || "")
    .trim()
    .toLowerCase();
  const sanitizedDomain = String(domain || "")
    .trim()
    .toLowerCase();
  const sanitizedHostname = String(hostname || "")
    .trim()
    .toLowerCase();
  const parsedPort = Number.parseInt(String(port || ""), 10);
  const sanitizedTargetUrl = String(targetUrl || "").trim();
  const sanitizedMode = mode === "redirect" ? "redirect" : "proxy";

  if (!sanitizedSubdomain || !sanitizedDomain) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  if (
    !sanitizedTargetUrl &&
    (!sanitizedHostname || Number.isNaN(parsedPort))
  ) {
    return c.json(
      { error: "Missing target: provide hostname/port or targetUrl" },
      400,
    );
  }

  if (sanitizedTargetUrl) {
    try {
      const urlObj = new URL(sanitizedTargetUrl);
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return c.json({ error: "Invalid URL protocol" }, 400);
      }
    } catch {
      return c.json({ error: "Invalid targetUrl format" }, 400);
    }
  }

  if (sanitizedMode === "redirect" && !sanitizedTargetUrl) {
    return c.json({ error: "Redirect mode requires targetUrl" }, 400);
  }

  const availableDomains = process.env.DOMAINS
    ? process.env.DOMAINS.split(" ")
    : [];
  if (!availableDomains.includes(sanitizedDomain)) {
    return c.json({ error: "Invalid base domain" }, 400);
  }

  const fullSubdomain = `${sanitizedSubdomain}.${sanitizedDomain}`;

  const bannedDomainCheck = await db
    .select()
    .from(bannedDomainsTable)
    .where(eq(bannedDomainsTable.domain, fullSubdomain));
  if (bannedDomainCheck.length > 0) {
    return c.json({ error: "Domain is banned" }, 403);
  }

  if (!sanitizedTargetUrl && sanitizedHostname) {
    const bannedIpCheck = await db
      .select()
      .from(bannedIpsTable)
      .where(eq(bannedIpsTable.ip, sanitizedHostname));
    if (bannedIpCheck.length > 0) {
      return c.json({ error: "IP Address is banned" }, 403);
    }
  }

  if (await redis.exists(fullSubdomain)) {
    return c.json({ error: "Subdomain already taken" }, 400);
  }

  try {
    if (sanitizedTargetUrl) {
      const urlObj = new URL(sanitizedTargetUrl);
      const targetHostname = urlObj.hostname;
      const targetPort =
        urlObj.port || (urlObj.protocol === "https:" ? 443 : 80);
      const isRedirect = sanitizedMode === "redirect";

      if (isRedirect) {
        await redis.set(fullSubdomain, `r:${sanitizedTargetUrl}`);
      } else {
        await redis.set(fullSubdomain, `${targetHostname}:${targetPort}`);
      }

      const inserted = await db
        .insert(domainTable)
        .values({
          userId: user.id,
          subdomain: fullSubdomain,
          hostname: targetHostname,
          port: targetPort,
          targetUrl: sanitizedTargetUrl,
          mode: sanitizedMode,
        })
        .returning();

      return c.json({ domain: inserted[0] });
    }

    await redis.set(fullSubdomain, `${sanitizedHostname}:${parsedPort}`);
    const inserted = await db
      .insert(domainTable)
      .values({
        userId: user.id,
        subdomain: fullSubdomain,
        hostname: sanitizedHostname,
        port: parsedPort,
        mode: sanitizedMode,
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
