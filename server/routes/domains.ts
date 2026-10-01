import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteDomainRoute, redis } from "server/db/redis";
import { db } from "../db";
import {
  bannedDomainsTable,
  bannedIpsTable,
  domainTable,
} from "../db/schema";
import { jwtMiddleware } from "../middleware/auth";

export const domainsRouter = new Hono<{ Variables: { user: any } }>();
domainsRouter.use("*", jwtMiddleware);

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

interface TargetInput {
  mode?: unknown;
  hostname?: unknown;
  port?: unknown;
  targetUrl?: unknown;
}

interface ParsedTarget {
  mode: "proxy" | "redirect";
  redisValue: string;
  hostname: string | null;
  port: number | null;
  targetUrl: string | null;
}

type TargetParseResult = { target: ParsedTarget } | { error: string };

// Builds the proxy target stored in redis. Plain host/port entries keep the
// historical "host:port" format (http); https upstreams are prefixed with
// their scheme so the proxy knows to connect over TLS.
function buildProxyTarget(hostname: string, port: number, scheme: string) {
  return scheme === "https"
    ? `https://${hostname}:${port}`
    : `${hostname}:${port}`;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : null;
  } catch {
    return null;
  }
}

function defaultPort(url: URL) {
  return url.port
    ? Number.parseInt(url.port, 10)
    : url.protocol === "https:"
      ? 443
      : 80;
}

// Validates and normalizes the routing target, shared by create and update.
// Proxy routes accept a hostname/port pair or a full URL; redirect routes
// require the URL visitors are sent to.
function parseTargetInput(input: TargetInput): TargetParseResult {
  const sanitizedHostname = String(input.hostname || "")
    .trim()
    .toLowerCase();
  const sanitizedTargetUrl = String(input.targetUrl || "").trim();
  const parsedPort = Number.parseInt(String(input.port || ""), 10);
  const mode = input.mode === "redirect" ? "redirect" : "proxy";

  if (mode === "redirect") {
    if (!sanitizedTargetUrl) {
      return { error: "Redirect mode requires targetUrl" };
    }
    const url = parseHttpUrl(sanitizedTargetUrl);
    if (!url) {
      return { error: "Invalid targetUrl format" };
    }
    return {
      target: {
        mode,
        redisValue: `r:${sanitizedTargetUrl}`,
        hostname: url.hostname,
        port: defaultPort(url),
        targetUrl: sanitizedTargetUrl,
      },
    };
  }

  if (sanitizedTargetUrl) {
    const url = parseHttpUrl(sanitizedTargetUrl);
    if (!url) {
      return { error: "Invalid targetUrl format" };
    }
    const port = defaultPort(url);
    return {
      target: {
        mode: "proxy",
        redisValue: buildProxyTarget(
          url.hostname,
          port,
          url.protocol === "https:" ? "https" : "http",
        ),
        hostname: url.hostname,
        port,
        targetUrl: sanitizedTargetUrl,
      },
    };
  }

  if (!sanitizedHostname || Number.isNaN(parsedPort)) {
    return { error: "Missing target: provide hostname/port or targetUrl" };
  }
  if (!HOSTNAME_PATTERN.test(sanitizedHostname)) {
    return { error: "Invalid destination hostname" };
  }
  if (parsedPort < 1 || parsedPort > 65535) {
    return { error: "Port must be between 1 and 65535" };
  }

  return {
    target: {
      mode: "proxy",
      redisValue: buildProxyTarget(sanitizedHostname, parsedPort, "http"),
      hostname: sanitizedHostname,
      port: parsedPort,
      targetUrl: null,
    },
  };
}

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
  const body = await c.req.json();
  const { subdomain, domain, ...targetInput } = body;

  const sanitizedSubdomain = String(subdomain || "")
    .trim()
    .toLowerCase();
  const sanitizedDomain = String(domain || "")
    .trim()
    .toLowerCase();

  if (!sanitizedSubdomain || !sanitizedDomain) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  if (!SUBDOMAIN_PATTERN.test(sanitizedSubdomain)) {
    return c.json(
      { error: "Subdomain may only contain letters, numbers and hyphens" },
      400,
    );
  }

  const parsed = parseTargetInput(targetInput);
  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
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

  if (parsed.target.targetUrl === null && parsed.target.hostname) {
    const bannedIpCheck = await db
      .select()
      .from(bannedIpsTable)
      .where(eq(bannedIpsTable.ip, parsed.target.hostname));
    if (bannedIpCheck.length > 0) {
      return c.json({ error: "IP Address is banned" }, 403);
    }
  }

  if (await redis.exists(fullSubdomain)) {
    return c.json({ error: "Subdomain already taken" }, 400);
  }

  try {
    await redis.set(fullSubdomain, parsed.target.redisValue);
    const inserted = await db
      .insert(domainTable)
      .values({
        userId: user.id,
        subdomain: fullSubdomain,
        hostname: parsed.target.hostname,
        port: parsed.target.port,
        targetUrl: parsed.target.targetUrl,
        mode: parsed.target.mode,
      })
      .returning();

    return c.json({ domain: inserted[0] });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: "Failed to register subdomain" }, 500);
  }
});

// Update an existing route's target: mode, destination host/port, or the
// redirect URL. The subdomain name itself is immutable.
domainsRouter.put("/:id", async (c) => {
  const user = c.get("user");
  const id = Number.parseInt(c.req.param("id"), 10);

  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid domain id" }, 400);
  }

  const domain = await db
    .select()
    .from(domainTable)
    .where(eq(domainTable.id, id));

  if (domain.length === 0 || !domain[0]) {
    return c.json({ error: "Domain not found" }, 404);
  }

  const existing = domain[0];
  if (existing.userId !== user.id && !user.isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const parsed = parseTargetInput(await c.req.json());
  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  if (parsed.target.targetUrl === null && parsed.target.hostname) {
    const bannedIpCheck = await db
      .select()
      .from(bannedIpsTable)
      .where(eq(bannedIpsTable.ip, parsed.target.hostname));
    if (bannedIpCheck.length > 0) {
      return c.json({ error: "IP Address is banned" }, 403);
    }
  }

  try {
    await redis.set(existing.subdomain, parsed.target.redisValue);
    const updated = await db
      .update(domainTable)
      .set({
        hostname: parsed.target.hostname,
        port: parsed.target.port,
        targetUrl: parsed.target.targetUrl,
        mode: parsed.target.mode,
      })
      .where(eq(domainTable.id, id))
      .returning();

    return c.json({ domain: updated[0] });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: "Failed to update subdomain" }, 500);
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
  if (subdomain) await deleteDomainRoute(subdomain);
  return c.json({ success: true });
});
