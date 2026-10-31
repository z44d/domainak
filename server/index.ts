import { swaggerUI } from "@hono/swagger-ui";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "./db";
import { domainDnsRecordsTable, domainTable } from "./db/schema";
import { openApiDoc } from "./openapi";
import { powerDns } from "./powerdns";
import { rebuildRecordRoutes } from "./record-routes";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { domainsRouter } from "./routes/domains";
import { statsRouter } from "./routes/stats";
import { startSettingsRefresher } from "./settings";

const app = new Hono();
const apiRouter = new Hono();

function registerApiRoutes(router: Hono) {
  router.route("/auth", authRouter);
  router.route("/domains", domainsRouter);
  router.route("/admin", adminRouter);
  router.route("/stats", statsRouter);

  router.get("/doc", (c) => c.json(openApiDoc));
  router.get("/swagger", swaggerUI({ url: "/doc" }));
}

app.use("*", (c, next) => {
  const corsMiddleware = cors({
    origin: c.req.header("Origin") ?? "",
    credentials: true,
  });
  return corsMiddleware(c, next);
});

registerApiRoutes(app);
registerApiRoutes(apiRouter);
app.route("/api", apiRouter);

app.get("/", (c) => {
  return c.json({ message: "Domainak API is running" });
});

app.get("/api", (c) => {
  return c.json({ message: "Domainak API is running" });
});

export default {
  port: process.env.PORT || 2007,
  fetch: app.fetch,
};

console.log(
  `Server running on http://localhost:${process.env.PORT || 2007}`,
);

// Keeps the UTC offsets embedded in published service-window payloads in
// sync with daylight saving transitions.
startSettingsRefresher();

// Reconciles PowerDNS with Postgres at boot: every domain that has
// records gets its zone created and every stored owner name
// republished, so rows left "synced" by an earlier publishing setup
// (or by a PowerDNS restart with an empty database) match what
// resolves. The proxy record routes are rebuilt too, whether or not
// PowerDNS is configured: they are what makes a record's name serve
// its target through the proxy. Failures are logged and retried
// lazily on the next write; the server never blocks on DNS.
async function warmupDnsZones(): Promise<void> {
  if (powerDns.configured()) {
    try {
      const names = await db
        .select({
          domainId: domainDnsRecordsTable.domainId,
          name: domainDnsRecordsTable.name,
        })
        .from(domainDnsRecordsTable)
        .groupBy(
          domainDnsRecordsTable.domainId,
          domainDnsRecordsTable.name,
        );
      const ids = [...new Set(names.map((row) => row.domainId))];
      const domains = await db
        .select({
          id: domainTable.id,
          subdomain: domainTable.subdomain,
        })
        .from(domainTable)
        .where(inArray(domainTable.id, ids));
      for (const domain of domains) {
        await powerDns.ensureZone(domain.subdomain);
        const domainNames = names.filter(
          (row) => row.domainId === domain.id,
        );
        for (const entry of domainNames) {
          const rows = await db
            .select()
            .from(domainDnsRecordsTable)
            .where(
              and(
                eq(domainDnsRecordsTable.domainId, domain.id),
                eq(domainDnsRecordsTable.name, entry.name),
              ),
            );
          await powerDns.publishName(
            domain.subdomain,
            entry.name,
            rows.map((row) => ({
              type: row.type,
              value: row.value,
              ttl: row.ttl,
            })),
          );
        }
        console.log(`DNS zone ready: ${domain.subdomain}`);
      }
    } catch (error) {
      console.error("Failed to warm up DNS zones:", error);
    }
  }
  try {
    await rebuildRecordRoutes();
  } catch (error) {
    console.error("Failed to warm up DNS record routes:", error);
  }
}

void warmupDnsZones();
