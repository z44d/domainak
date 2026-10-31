import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { redis } from "./db/redis";
import { domainDnsRecordsTable } from "./db/schema";

// Proxy routes for DNS records.
//
// Publishing a record to PowerDNS only answers DNS queries. A name
// that reaches this server through the proxy (the base domains'
// wildcard points at the tunnel) would otherwise hit the
// "subdomain isn't claimed yet" page, because the proxy only knows
// registered domain routes. So every A, AAAA or CNAME record also
// gets a proxy route in Redis, under a `record:` key that the
// OpenResty config consults when no registered route matches the
// host (see nginx.conf). Registered routes always win: they live
// under the bare hostname key and are checked first.
//
// The value uses the same formats the proxy already understands:
// "host:port" (HTTP upstream), "https://host" (HTTPS upstream) or,
// for IPv6, "[address]" (HTTP upstream, port 80). CNAME targets are
// proxied over HTTPS with the original Host header, exactly as a
// real DNS CNAME resolution would behave: the target must be
// configured to serve the record's hostname. Other record types
// (TXT, MX, NS, ...) are DNS-only and get no proxy route.
//
// Postgres stays the source of truth. Redis writes are best-effort
// and never throw: a failed write is logged and retried on the next
// record change or at boot (see warmupDnsZones in index.ts).

export const RECORD_ROUTE_PREFIX = "record:";

export function recordRouteKey(fqdn: string): string {
  return `${RECORD_ROUTE_PREFIX}${fqdn}`;
}

export interface RecordRouteRow {
  type: string;
  value: string;
}

// Which upstream a name's rows route to, if any. A CNAME wins over
// an A/AAAA row at the same name (DNS forbids mixing them, but the
// stored rows are the tiebreak if they ever do). The first A or
// AAAA row wins; additional addresses keep resolving through DNS.
export function recordRouteTarget(rows: RecordRouteRow[]): string | null {
  const cname = rows.find((row) => row.type === "CNAME");
  if (cname) {
    return `https://${cname.value}`;
  }
  const a = rows.find((row) => row.type === "A");
  if (a) {
    return a.value;
  }
  const aaaa = rows.find((row) => row.type === "AAAA");
  if (aaaa) {
    return `[${aaaa.value}]`;
  }
  return null;
}

// Minimal Redis surface the route sync needs, so tests can inject a
// fake store instead of a live Redis connection.
export interface RecordRouteStore {
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export async function syncRecordRoute(
  fqdn: string,
  rows: RecordRouteRow[],
  store: RecordRouteStore = redis,
): Promise<void> {
  const target = recordRouteTarget(rows);
  try {
    if (target) {
      await store.set(recordRouteKey(fqdn), target);
    } else {
      await store.del(recordRouteKey(fqdn));
    }
  } catch (error) {
    console.error(`Failed to sync proxy route for ${fqdn}:`, error);
  }
}

export async function removeRecordRoute(
  fqdn: string,
  store: RecordRouteStore = redis,
): Promise<void> {
  try {
    await store.del(recordRouteKey(fqdn));
  } catch (error) {
    console.error(`Failed to remove proxy route for ${fqdn}:`, error);
  }
}

// Re-reads one name's current rows from Postgres and syncs (or
// removes) its proxy route, so the route can never drift from the
// stored records. Call after every record mutation.
export async function refreshRecordRoute(
  domainId: number,
  fqdn: string,
  store: RecordRouteStore = redis,
): Promise<void> {
  try {
    const rows = await db
      .select({
        type: domainDnsRecordsTable.type,
        value: domainDnsRecordsTable.value,
      })
      .from(domainDnsRecordsTable)
      .where(
        and(
          eq(domainDnsRecordsTable.domainId, domainId),
          eq(domainDnsRecordsTable.name, fqdn),
        ),
      )
      .orderBy(asc(domainDnsRecordsTable.id));
    await syncRecordRoute(fqdn, rows, store);
  } catch (error) {
    console.error(`Failed to refresh proxy route for ${fqdn}:`, error);
  }
}

// Rebuilds every record proxy route from Postgres. Used at boot so
// a Redis restart (or a deploy from before record routes existed)
// cannot leave names routing to the claim page.
export async function rebuildRecordRoutes(
  store: RecordRouteStore = redis,
): Promise<void> {
  const rows = await db
    .select({
      domainId: domainDnsRecordsTable.domainId,
      name: domainDnsRecordsTable.name,
      type: domainDnsRecordsTable.type,
      value: domainDnsRecordsTable.value,
    })
    .from(domainDnsRecordsTable)
    .orderBy(
      asc(domainDnsRecordsTable.domainId),
      asc(domainDnsRecordsTable.name),
      asc(domainDnsRecordsTable.id),
    );
  const byName = new Map<string, RecordRouteRow[]>();
  for (const row of rows) {
    const key = row.name;
    const bucket = byName.get(key) ?? [];
    bucket.push({ type: row.type, value: row.value });
    byName.set(key, bucket);
  }
  for (const [fqdn, nameRows] of byName) {
    await syncRecordRoute(fqdn, nameRows, store);
  }
  if (byName.size > 0) {
    console.log(`DNS record routes ready: ${byName.size} names`);
  }
}
