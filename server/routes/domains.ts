import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteDomainRoute, redis } from "server/db/redis";
import { db } from "../db";
import {
  bannedDomainsTable,
  bannedIpsTable,
  domainDnsRecordsTable,
  domainTable,
} from "../db/schema";
import { jwtMiddleware } from "../middleware/auth";
import {
  type DomainRuleSettings,
  parseSettingsInput,
  publishDomainSettings,
  serviceWindowMeta,
} from "../settings";
import {
  createDomainRecord,
  deleteDomainRecord,
  listDomainRecords,
  removeDomainDnsRecords,
  retryDomainRecord,
  updateDomainRecord,
} from "./domain-records";

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

// Get user's domains, each with its DNS record count so the list can
// summarise the records section without a second request per domain.
domainsRouter.get("/", async (c) => {
  const user = c.get("user");
  const domains = await db
    .select()
    .from(domainTable)
    .where(eq(domainTable.userId, user.id));
  const counts = await db
    .select({
      domainId: domainDnsRecordsTable.domainId,
      count: sql<number>`count(*)`,
    })
    .from(domainDnsRecordsTable)
    .groupBy(domainDnsRecordsTable.domainId);
  const countByDomain = new Map(
    counts.map((row) => [row.domainId, Number(row.count)]),
  );

  // The dashboard shows the local service window next to its GMT conversion,
  // so the offset is computed here instead of letting the client guess it.
  return c.json({
    domains: domains.map((row) => ({
      ...row,
      recordCount: countByDomain.get(row.id) ?? 0,
      serviceWindow: serviceWindowMeta(row),
    })),
  });
});

// DNS records for one domain, managed from that domain's settings.
domainsRouter.get("/:id/records", listDomainRecords);
domainsRouter.post("/:id/records", createDomainRecord);
domainsRouter.put("/:id/records/:recordId", updateDomainRecord);
domainsRouter.delete("/:id/records/:recordId", deleteDomainRecord);
domainsRouter.post("/:id/records/:recordId/retry", retryDomainRecord);

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

  // One hostname maps to exactly one route, so it can be registered only
  // once — as a proxy or as a redirect, never twice. The table is queried
  // directly because a missing redis key (fresh redis, older rows) must not
  // let an already used name through.
  const existingRoute = await db
    .select({ id: domainTable.id })
    .from(domainTable)
    .where(eq(domainTable.subdomain, fullSubdomain));
  if (existingRoute.length > 0) {
    return c.json({ error: "Subdomain is already in use" }, 409);
  }

  if (await redis.exists(fullSubdomain)) {
    return c.json({ error: "Subdomain is already in use" }, 409);
  }

  try {
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

    const route = inserted[0];
    if (!route) {
      return c.json({ error: "Failed to register subdomain" }, 500);
    }

    try {
      await redis.set(fullSubdomain, parsed.target.redisValue);
    } catch (redisError) {
      // The row is written first and published to redis afterwards, so a
      // failed publish is rolled back instead of leaving a hostname that
      // has no route entry behind it.
      console.error("Failed to publish route to redis:", redisError);
      await db.delete(domainTable).where(eq(domainTable.id, route.id));
      return c.json({ error: "Failed to register subdomain" }, 500);
    }

    return c.json({ domain: route });
  } catch (error: any) {
    // 23505 is the unique violation on `domain.subdomain`, raised when a
    // concurrent request claims the same hostname first.
    if (error?.code === "23505") {
      return c.json({ error: "Subdomain is already in use" }, 409);
    }

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

// Update an existing route's access rules: country policy, maintenance mode
// and service window. Rules are validated, published to redis for the edge
// proxy, then stored as the source of truth on the row.
domainsRouter.put("/:id/settings", async (c) => {
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

  const parsed = parseSettingsInput(await c.req.json());
  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const settings: DomainRuleSettings = parsed.settings;

  try {
    await publishDomainSettings(existing.subdomain, settings);
    const updated = await db
      .update(domainTable)
      .set({
        geoMode: settings.geoMode,
        geoCountries: settings.geoCountries,
        maintenance: settings.maintenance,
        maintenanceMessage: settings.maintenanceMessage,
        serviceHours: settings.serviceHours,
        timezone: settings.timezone,
        serviceStart: settings.serviceStart,
        serviceEnd: settings.serviceEnd,
      })
      .where(eq(domainTable.id, id))
      .returning();

    const route = updated[0];
    if (!route) {
      return c.json({ error: "Failed to update subdomain rules" }, 500);
    }

    return c.json({
      domain: { ...route, serviceWindow: serviceWindowMeta(route) },
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to update subdomain rules" }, 500);
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

  // The domain's PowerDNS zone is removed first; the
  // domain row delete then cascades to the remaining record rows.
  await removeDomainDnsRecords(id);
  await db.delete(domainTable).where(eq(domainTable.id, id));
  const subdomain = domain[0]?.subdomain;
  if (subdomain) await deleteDomainRoute(subdomain);
  return c.json({ success: true });
});
