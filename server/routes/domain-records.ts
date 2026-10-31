import { and, asc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../db";
import {
  bannedDomainsTable,
  bannedIpsTable,
  domainDnsRecordsTable,
  domainTable,
} from "../db/schema";
import {
  cnameConflictError,
  type DnsRecordType,
  isDnsRecordType,
  recordTargetHost,
  resolveRecordName,
  validateRecordValue,
  validateTtl,
} from "../dns-validation";
import {
  type DelegationCheck,
  type DnsRowInput,
  PdnsError,
  powerDns,
} from "../powerdns";
import { refreshRecordRoute, removeRecordRoute } from "../record-routes";

// DNS records for one registered domain, managed from that domain's
// settings. Records live under the domain itself (@ is the domain,
// "www" is www.<domain>) and are published in the domain's own
// authoritative zone in the project's PowerDNS server. Postgres is
// the source of truth: a record is always saved, and syncStatus
// reports whether PowerDNS holds the same copy, so a missing or
// unreachable PowerDNS never silently loses a record — it stays
// "pending"/"failed" with a Retry. The zone only resolves publicly
// once the domain is delegated to this server's nameservers (see the
// delegation info returned by the list endpoint).

type RecordRow = typeof domainDnsRecordsTable.$inferSelect;

type PublicRecord = RecordRow;

function toPublicRecord(row: RecordRow): PublicRecord {
  return { ...row };
}

type DomainRow = typeof domainTable.$inferSelect;

async function loadDomain(
  c: Context,
  id: number,
): Promise<DomainRow | null> {
  const user = c.get("user");
  const found = await db
    .select()
    .from(domainTable)
    .where(eq(domainTable.id, id));
  const domain = found[0];
  if (!domain) {
    return null;
  }
  if (domain.userId !== user.id && !user.isAdmin) {
    return null;
  }
  return domain;
}

async function findBannedError(
  name: string,
  type: DnsRecordType,
  value: string,
): Promise<string | null> {
  const bannedDomain = await db
    .select({ id: bannedDomainsTable.id })
    .from(bannedDomainsTable)
    .where(eq(bannedDomainsTable.domain, name));
  if (bannedDomain.length > 0) {
    return "Domain is banned";
  }

  const target = recordTargetHost(type, value);
  if (target) {
    const bannedTarget = await db
      .select({ id: bannedIpsTable.id })
      .from(bannedIpsTable)
      .where(eq(bannedIpsTable.ip, target));
    if (bannedTarget.length > 0) {
      return "IP Address is banned";
    }
  }
  return null;
}

interface ParsedRecordInput {
  fqdn: string;
  type: DnsRecordType;
  value: string;
  ttl: number;
  comment: string | null;
}

async function parseRecordInput(
  body: Record<string, unknown>,
  domain: DomainRow,
): Promise<ParsedRecordInput | { error: string }> {
  const type = String(body.type ?? "").toUpperCase();
  if (!isDnsRecordType(type)) {
    return {
      error:
        "Type must be one of: A, AAAA, CNAME, TXT, MX, NS, " +
        "SRV, CAA, PTR, DS, HTTPS, SVCB, CERT, SSHFP, TLSA, NAPTR",
    };
  }

  const ttlResult = validateTtl(body.ttl);
  if (!ttlResult.ok) {
    return { error: ttlResult.error };
  }

  const nameResult = resolveRecordName(domain.subdomain, body.name);
  if (!nameResult.ok) {
    return { error: nameResult.error };
  }

  const valueResult = validateRecordValue(type, body.value);
  if (!valueResult.ok) {
    return { error: valueResult.error };
  }

  // An NS record at the apex would replace the zone's own nameserver
  // set in PowerDNS. Delegate a subdomain name instead.
  if (type === "NS" && nameResult.value.fqdn === domain.subdomain) {
    return {
      error:
        "NS records cannot be set at the domain apex: the zone's " +
        "nameservers already live there. Use a subdomain name to " +
        "delegate it.",
    };
  }

  const comment = String(body.comment ?? "").trim();
  if (comment.length > 255) {
    return { error: "Comment must be at most 255 characters" };
  }

  return {
    fqdn: nameResult.value.fqdn,
    type,
    value: valueResult.value,
    ttl: ttlResult.value,
    comment: comment || null,
  };
}

function syncErrorMessage(error: unknown): string {
  if (error instanceof PdnsError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to publish the record";
}

function toRowInput(row: {
  type: string;
  value: string;
  ttl: number;
}): DnsRowInput {
  return { type: row.type, value: row.value, ttl: row.ttl };
}

// Publishes one owner name's full row set to PowerDNS. Throws on
// PowerDNS errors; returns false when publishing is not configured.
async function publishNameRows(
  zone: string,
  fqdn: string,
  rows: DnsRowInput[],
): Promise<boolean> {
  if (!powerDns.configured()) {
    return false;
  }
  await powerDns.publishName(zone, fqdn, rows);
  return true;
}

async function markPublishState(
  id: number,
  outcome:
    | { status: "synced" }
    | { status: "pending" | "failed"; error: string },
): Promise<RecordRow | undefined> {
  const updated = await db
    .update(domainDnsRecordsTable)
    .set(
      outcome.status === "synced"
        ? {
            syncStatus: "synced",
            syncError: null,
          }
        : {
            syncStatus: outcome.status,
            syncError: outcome.error,
          },
    )
    .where(eq(domainDnsRecordsTable.id, id))
    .returning();
  return updated[0];
}

function notConfiguredError(): string {
  return (
    "Not published: PowerDNS is not configured " +
    "on the server. The record is saved and will publish " +
    "once PowerDNS is configured."
  );
}

export async function listDomainRecords(c: Context) {
  const id = Number.parseInt(c.req.param("id") ?? "", 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid domain id" }, 400);
  }
  const domain = await loadDomain(c, id);
  if (!domain) {
    return c.json({ error: "Domain not found" }, 404);
  }

  const forceCheck = c.req.query("refreshDelegation") === "1";
  const delegationPromise: Promise<DelegationCheck> =
    powerDns.checkDelegation(domain.subdomain, { force: forceCheck });

  const rows = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(eq(domainDnsRecordsTable.domainId, id))
    .orderBy(
      asc(domainDnsRecordsTable.name),
      asc(domainDnsRecordsTable.type),
      asc(domainDnsRecordsTable.id),
    );
  const delegation = await delegationPromise;

  return c.json({
    domain: domain.subdomain,
    dnsConfigured: powerDns.configured(),
    nameservers: powerDns.nameservers(),
    delegation,
    records: rows.map(toPublicRecord),
  });
}

export async function createDomainRecord(c: Context) {
  const user = c.get("user");
  const id = Number.parseInt(c.req.param("id") ?? "", 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid domain id" }, 400);
  }
  const domain = await loadDomain(c, id);
  if (!domain) {
    return c.json({ error: "Domain not found" }, 404);
  }

  const parsed = await parseRecordInput(await c.req.json(), domain);
  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const banned = await findBannedError(
    parsed.fqdn,
    parsed.type,
    parsed.value,
  );
  if (banned) {
    return c.json({ error: banned }, 403);
  }

  const siblings = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(
      and(
        eq(domainDnsRecordsTable.domainId, id),
        eq(domainDnsRecordsTable.name, parsed.fqdn),
      ),
    );

  const conflict = cnameConflictError(siblings, parsed.type);
  if (conflict) {
    return c.json({ error: conflict }, 400);
  }

  const duplicate = siblings.some(
    (row) => row.type === parsed.type && row.value === parsed.value,
  );
  if (duplicate) {
    return c.json({ error: "Record already exists" }, 409);
  }

  const inserted = await db
    .insert(domainDnsRecordsTable)
    .values({
      domainId: id,
      userId: user.id,
      name: parsed.fqdn,
      type: parsed.type,
      value: parsed.value,
      ttl: parsed.ttl,
      comment: parsed.comment,
      syncStatus: "pending",
    })
    .returning();
  const record = inserted[0];
  if (!record) {
    return c.json({ error: "Failed to create record" }, 500);
  }

  if (!powerDns.configured()) {
    const saved = await markPublishState(record.id, {
      status: "pending",
      error: notConfiguredError(),
    });
    // The proxy route does not depend on PowerDNS: a name that
    // reaches the proxy through the wildcard still serves its
    // target.
    await refreshRecordRoute(id, parsed.fqdn);
    return c.json({ record: toPublicRecord(saved ?? record) }, 201);
  }

  try {
    await publishNameRows(domain.subdomain, parsed.fqdn, [
      ...siblings.map(toRowInput),
      toRowInput(record),
    ]);
    const saved = await markPublishState(record.id, {
      status: "synced",
    });
    await refreshRecordRoute(id, parsed.fqdn);
    return c.json({ record: toPublicRecord(saved ?? record) }, 201);
  } catch (error) {
    const saved = await markPublishState(record.id, {
      status: "failed",
      error: syncErrorMessage(error),
    });
    await refreshRecordRoute(id, parsed.fqdn);
    return c.json({ record: toPublicRecord(saved ?? record) }, 201);
  }
}

export async function updateDomainRecord(c: Context) {
  const id = Number.parseInt(c.req.param("id") ?? "", 10);
  const recordId = Number.parseInt(c.req.param("recordId") ?? "", 10);
  if (Number.isNaN(id) || Number.isNaN(recordId)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const domain = await loadDomain(c, id);
  if (!domain) {
    return c.json({ error: "Domain not found" }, 404);
  }

  const found = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(
      and(
        eq(domainDnsRecordsTable.id, recordId),
        eq(domainDnsRecordsTable.domainId, id),
      ),
    );
  const existing = found[0];
  if (!existing) {
    return c.json({ error: "Record not found" }, 404);
  }

  const parsed = await parseRecordInput(await c.req.json(), domain);
  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const banned = await findBannedError(
    parsed.fqdn,
    parsed.type,
    parsed.value,
  );
  if (banned) {
    return c.json({ error: banned }, 403);
  }

  const siblings = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(
      and(
        eq(domainDnsRecordsTable.domainId, id),
        eq(domainDnsRecordsTable.name, parsed.fqdn),
      ),
    );

  const conflict = cnameConflictError(siblings, parsed.type, recordId);
  if (conflict) {
    return c.json({ error: conflict }, 400);
  }

  const duplicate = siblings.some(
    (row) =>
      row.id !== recordId &&
      row.type === parsed.type &&
      row.value === parsed.value,
  );
  if (duplicate) {
    return c.json({ error: "Record already exists" }, 409);
  }

  const unchanged =
    existing.name === parsed.fqdn &&
    existing.type === parsed.type &&
    existing.value === parsed.value &&
    existing.ttl === parsed.ttl &&
    (existing.comment ?? null) === parsed.comment;

  // Publish the new values first: if PowerDNS rejects them, the
  // stored row keeps describing what actually resolves.
  if (!unchanged) {
    if (!powerDns.configured()) {
      return c.json({ error: notConfiguredError() }, 503);
    }
    try {
      // A renamed record leaves its old owner name behind: rebuild
      // that name too, or its stale rrsets keep resolving.
      if (parsed.fqdn !== existing.name) {
        const oldSiblings = await db
          .select()
          .from(domainDnsRecordsTable)
          .where(
            and(
              eq(domainDnsRecordsTable.domainId, id),
              eq(domainDnsRecordsTable.name, existing.name),
            ),
          );
        await publishNameRows(
          domain.subdomain,
          existing.name,
          oldSiblings.filter((row) => row.id !== recordId).map(toRowInput),
        );
      }
      const newNameRows = siblings.map((row) =>
        row.id === recordId
          ? {
              type: parsed.type,
              value: parsed.value,
              ttl: parsed.ttl,
            }
          : toRowInput(row),
      );
      if (!siblings.some((row) => row.id === recordId)) {
        newNameRows.push({
          type: parsed.type,
          value: parsed.value,
          ttl: parsed.ttl,
        });
      }
      await publishNameRows(domain.subdomain, parsed.fqdn, newNameRows);
      const updated = await db
        .update(domainDnsRecordsTable)
        .set({
          name: parsed.fqdn,
          type: parsed.type,
          value: parsed.value,
          ttl: parsed.ttl,
          comment: parsed.comment,
          syncStatus: "synced",
          syncError: null,
        })
        .where(eq(domainDnsRecordsTable.id, recordId))
        .returning();
      const saved = updated[0];
      if (!saved) {
        return c.json({ error: "Failed to update record" }, 500);
      }
      await refreshRecordRoute(id, parsed.fqdn);
      if (parsed.fqdn !== existing.name) {
        await refreshRecordRoute(id, existing.name);
      }
      return c.json({ record: toPublicRecord(saved) });
    } catch (error) {
      return c.json({ error: syncErrorMessage(error) }, 500);
    }
  }

  // Nothing changed except possibly a retry of a failed publish.
  if (existing.syncStatus !== "synced" && powerDns.configured()) {
    try {
      await publishNameRows(
        domain.subdomain,
        parsed.fqdn,
        siblings.map(toRowInput),
      );
      const updated = await db
        .update(domainDnsRecordsTable)
        .set({
          syncStatus: "synced",
          syncError: null,
        })
        .where(eq(domainDnsRecordsTable.id, recordId))
        .returning();
      const saved = updated[0];
      if (saved) {
        await refreshRecordRoute(id, parsed.fqdn);
        return c.json({ record: toPublicRecord(saved) });
      }
    } catch (error) {
      return c.json({ error: syncErrorMessage(error) }, 500);
    }
  }

  return c.json({ record: toPublicRecord(existing) });
}

export async function deleteDomainRecord(c: Context) {
  const id = Number.parseInt(c.req.param("id") ?? "", 10);
  const recordId = Number.parseInt(c.req.param("recordId") ?? "", 10);
  if (Number.isNaN(id) || Number.isNaN(recordId)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const domain = await loadDomain(c, id);
  if (!domain) {
    return c.json({ error: "Domain not found" }, 404);
  }

  const found = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(
      and(
        eq(domainDnsRecordsTable.id, recordId),
        eq(domainDnsRecordsTable.domainId, id),
      ),
    );
  const record = found[0];
  if (!record) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Only a name with published rows needs rebuilding: a
  // pending/failed row that is alone at its name never reached
  // PowerDNS, so deleting it needs no DNS call.
  const siblings = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(
      and(
        eq(domainDnsRecordsTable.domainId, id),
        eq(domainDnsRecordsTable.name, record.name),
      ),
    );
  const needsRebuild =
    record.syncStatus === "synced" ||
    siblings.some(
      (row) => row.id !== recordId && row.syncStatus === "synced",
    );
  if (needsRebuild && powerDns.configured()) {
    try {
      await publishNameRows(
        domain.subdomain,
        record.name,
        siblings.filter((row) => row.id !== recordId).map(toRowInput),
      );
    } catch (error) {
      return c.json({ error: syncErrorMessage(error) }, 500);
    }
  }

  await db
    .delete(domainDnsRecordsTable)
    .where(eq(domainDnsRecordsTable.id, recordId));
  await refreshRecordRoute(id, record.name);
  return c.json({ success: true });
}

export async function retryDomainRecord(c: Context) {
  const id = Number.parseInt(c.req.param("id") ?? "", 10);
  const recordId = Number.parseInt(c.req.param("recordId") ?? "", 10);
  if (Number.isNaN(id) || Number.isNaN(recordId)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const domain = await loadDomain(c, id);
  if (!domain) {
    return c.json({ error: "Domain not found" }, 404);
  }

  const found = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(
      and(
        eq(domainDnsRecordsTable.id, recordId),
        eq(domainDnsRecordsTable.domainId, id),
      ),
    );
  const record = found[0];
  if (!record) {
    return c.json({ error: "Record not found" }, 404);
  }

  if (!powerDns.configured()) {
    const saved = await markPublishState(record.id, {
      status: "pending",
      error: notConfiguredError(),
    });
    await refreshRecordRoute(id, record.name);
    return c.json({ record: toPublicRecord(saved ?? record) });
  }

  try {
    const siblings = await db
      .select()
      .from(domainDnsRecordsTable)
      .where(
        and(
          eq(domainDnsRecordsTable.domainId, id),
          eq(domainDnsRecordsTable.name, record.name),
        ),
      );
    await publishNameRows(
      domain.subdomain,
      record.name,
      siblings.map(toRowInput),
    );
    const saved = await markPublishState(record.id, {
      status: "synced",
    });
    await refreshRecordRoute(id, record.name);
    return c.json({ record: toPublicRecord(saved ?? record) });
  } catch (error) {
    const saved = await markPublishState(record.id, {
      status: "failed",
      error: syncErrorMessage(error),
    });
    return c.json({ record: toPublicRecord(saved ?? record) });
  }
}

// Removes a domain's whole PowerDNS zone and then its rows,
// best-effort: a PowerDNS failure is logged, never thrown, so
// deleting or banning a domain can never be blocked by DNS cleanup.
// Callers still delete the domain row itself afterwards.
export async function removeDomainDnsRecords(
  domainId: number,
): Promise<void> {
  const found = await db
    .select({ subdomain: domainTable.subdomain })
    .from(domainTable)
    .where(eq(domainTable.id, domainId));
  const domain = found[0];
  const names = await db
    .select({ name: domainDnsRecordsTable.name })
    .from(domainDnsRecordsTable)
    .where(eq(domainDnsRecordsTable.domainId, domainId))
    .groupBy(domainDnsRecordsTable.name);
  if (domain && powerDns.configured()) {
    try {
      await powerDns.deleteZone(domain.subdomain);
    } catch (error) {
      console.error(
        `Failed to remove DNS zone ${domain.subdomain}:`,
        error,
      );
    }
  }
  await db
    .delete(domainDnsRecordsTable)
    .where(eq(domainDnsRecordsTable.domainId, domainId));
  // The zone is gone, so the names must stop routing through the
  // proxy too, or a deleted record keeps serving its old target.
  for (const row of names) {
    await removeRecordRoute(row.name);
  }
}

// Deletes one record on an admin's behalf: rebuilds the name in
// PowerDNS from the remaining rows (best-effort, so a DNS failure
// can never block moderation), deletes the row, and refreshes the
// proxy route. Returns the deleted record, or null when it does
// not exist.
export async function deleteDomainRecordRow(
  recordId: number,
): Promise<RecordRow | null> {
  const found = await db
    .select()
    .from(domainDnsRecordsTable)
    .where(eq(domainDnsRecordsTable.id, recordId));
  const record = found[0];
  if (!record) {
    return null;
  }
  const domains = await db
    .select({ subdomain: domainTable.subdomain })
    .from(domainTable)
    .where(eq(domainTable.id, record.domainId));
  const domain = domains[0];
  if (domain && powerDns.configured()) {
    try {
      const siblings = await db
        .select()
        .from(domainDnsRecordsTable)
        .where(
          and(
            eq(domainDnsRecordsTable.domainId, record.domainId),
            eq(domainDnsRecordsTable.name, record.name),
          ),
        );
      await publishNameRows(
        domain.subdomain,
        record.name,
        siblings.filter((row) => row.id !== recordId).map(toRowInput),
      );
    } catch (error) {
      console.error(
        `Failed to unpublish DNS record ${record.name}:`,
        error,
      );
    }
  }
  await db
    .delete(domainDnsRecordsTable)
    .where(eq(domainDnsRecordsTable.id, recordId));
  await refreshRecordRoute(record.domainId, record.name);
  return record;
}
