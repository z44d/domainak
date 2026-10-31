import { Resolver } from "node:dns/promises";
import { DNS_NAMESERVERS, PDNS_API_KEY, PDNS_API_URL } from "./config";
import { DNS_RECORD_TYPES } from "./dns-validation";

// PowerDNS client for the project's own DNS system. Every registered
// domain gets its own authoritative zone in PowerDNS (the zone name is
// the domain itself), and records are published there with the
// PowerDNS HTTP API. Nothing in this file talks to Cloudflare or any
// other DNS provider: the only outside step is the NS delegation,
// which the operator adds once per domain in the parent zone (see
// checkDelegation and the dashboard delegation card).
//
// Postgres stays the source of truth. publishName rebuilds every
// rrset at one owner name from the stored rows, so the published copy
// can never drift from the rows: types with no rows get a DELETE, and
// a failed publish leaves syncStatus "failed" with the error.

export class PdnsError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PdnsError";
    this.status = status;
  }
}

export interface DnsRowInput {
  type: string;
  value: string;
  ttl: number;
}

export type DelegationState = "delegated" | "pending" | "unknown";

export interface DelegationCheck {
  status: DelegationState;
  checkedAt: string;
}

export interface PowerDnsClientOptions {
  baseUrl?: string;
  apiKey?: string;
  nameservers?: string[];
}

const ZONE_TTL = 3600;

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, "");
}

function soaSerial(): number {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return Number(
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}01`,
  );
}

// Splits a TXT value into quoted character-strings of at most 255
// bytes each (the DNS limit), without splitting a UTF-8 character.
// Backslashes and tabs are escaped so PowerDNS reads the bytes back
// exactly as stored.
function encodeTxt(value: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of value) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > 255 && current.length > 0) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  if (current.length > 0 || chunks.length === 0) {
    chunks.push(current);
  }
  return chunks
    .map((chunk) => {
      const escaped = chunk
        .replace(/\\/g, "\\\\")
        .replace(/\t/g, "\\009")
        .replace(/"/g, '\\"');
      return `"${escaped}"`;
    })
    .join(" ");
}

function withDot(host: string): string {
  return host === "." ? "." : `${host}.`;
}

// Converts a stored (canonical) record value to the presentation
// format PowerDNS expects. Hostnames get their trailing dot; MX, SRV,
// HTTPS/SVCB and NAPTR targets are dotted the same way; everything
// else passes through unchanged.
export function toPowerDnsContent(type: string, value: string): string {
  if (type === "CNAME" || type === "NS" || type === "PTR") {
    return withDot(value);
  }
  if (type === "TXT") {
    return encodeTxt(value);
  }
  if (type === "MX") {
    const parts = value.split(/\s+/);
    return `${parts[0]} ${withDot(parts[1] ?? "")}`;
  }
  if (type === "SRV") {
    const parts = value.split(/\s+/);
    return `${parts[0]} ${parts[1]} ${parts[2]} ${withDot(parts[3] ?? "")}`;
  }
  if (type === "HTTPS" || type === "SVCB") {
    const parts = value.split(/\s+/);
    const rest = parts.slice(2);
    return (
      `${parts[0]} ${withDot(parts[1] ?? "")}` +
      (rest.length > 0 ? ` ${rest.join(" ")}` : "")
    );
  }
  if (type === "NAPTR") {
    const match =
      /^(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+"([^"]*)"\s+(\S+)$/.exec(
        value,
      );
    if (!match) {
      return value;
    }
    return (
      `${match[1]} ${match[2]} "${match[3]}" ` +
      `"${match[4]}" "${match[5]}" ${withDot(match[6] ?? "")}`
    );
  }
  return value;
}

export function createPowerDnsClient(options: PowerDnsClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? PDNS_API_URL)
    .trim()
    .replace(/\/+$/, "");
  const apiKey = options.apiKey ?? PDNS_API_KEY;
  const nameservers = (options.nameservers ?? DNS_NAMESERVERS).map(
    normalizeName,
  );

  const zoneReady = new Map<string, Promise<void>>();
  const delegationCache = new Map<
    string,
    { check: DelegationCheck; expiresAt: number }
  >();

  function configured(): boolean {
    return baseUrl.length > 0;
  }

  function requireBaseUrl(): string {
    if (!configured()) {
      throw new PdnsError(
        503,
        "PowerDNS is not configured on the server: " +
          "PDNS_API_URL is not set",
      );
    }
    return baseUrl;
  }

  function pdnsErrorFromBody(status: number, text: string): PdnsError {
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (body.error) {
        return new PdnsError(status, String(body.error));
      }
    } catch {
      // PowerDNS sometimes answers with plain text; fall through.
    }
    return new PdnsError(status, text || `PowerDNS responded ${status}`);
  }

  async function pdnsRequest(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const url = `${requireBaseUrl()}/api/v1/servers/localhost${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          ...init?.headers,
        },
      });
    } catch (error) {
      throw new PdnsError(
        503,
        `PowerDNS is unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw pdnsErrorFromBody(response.status, await response.text());
    }
    return response;
  }

  async function createZone(zone: string): Promise<void> {
    if (nameservers.length === 0) {
      throw new PdnsError(
        503,
        "No DNS nameservers are configured on the server",
      );
    }
    const fqdn = `${zone}.`;
    const response = await fetch(
      `${requireBaseUrl()}/api/v1/servers/localhost/zones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          name: fqdn,
          kind: "Native",
          nameservers: nameservers.map((name) => `${name}.`),
        }),
      },
    ).catch((error: unknown) => {
      throw new PdnsError(
        503,
        `PowerDNS is unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    if (response.status === 409) {
      return;
    }
    if (!response.ok) {
      throw pdnsErrorFromBody(response.status, await response.text());
    }
    await pdnsRequest(`/zones/${encodeURIComponent(fqdn)}`, {
      method: "PATCH",
      body: JSON.stringify({
        rrsets: [
          {
            name: fqdn,
            type: "SOA",
            ttl: ZONE_TTL,
            changetype: "REPLACE",
            records: [
              {
                content:
                  `${nameservers[0]}. hostmaster.${fqdn} ` +
                  `${soaSerial()} 10800 3600 604800 3600`,
                disabled: false,
              },
            ],
          },
          {
            name: fqdn,
            type: "NS",
            ttl: ZONE_TTL,
            changetype: "REPLACE",
            records: nameservers.map((name) => ({
              content: `${name}.`,
              disabled: false,
            })),
          },
        ],
      }),
    });
  }

  // Creates the zone on first use and caches the result per process.
  // A failed creation is forgotten so the next write retries it.
  function ensureZone(zone: string): Promise<void> {
    const key = normalizeName(zone);
    let pending = zoneReady.get(key);
    if (!pending) {
      pending = createZone(key).catch((error) => {
        zoneReady.delete(key);
        throw error;
      });
      zoneReady.set(key, pending);
    }
    return pending;
  }

  interface Rrset {
    name: string;
    type: string;
    changetype: "REPLACE" | "DELETE";
    ttl?: number;
    records?: { content: string; disabled: boolean }[];
  }

  async function patchRrsets(
    zone: string,
    rrsets: Rrset[],
  ): Promise<void> {
    if (rrsets.length === 0) {
      return;
    }
    const zonePath = `/zones/${encodeURIComponent(`${zone}.`)}`;
    try {
      await pdnsRequest(zonePath, {
        method: "PATCH",
        body: JSON.stringify({ rrsets }),
      });
    } catch (error) {
      // Deleting rrsets from a zone that does not exist is a no-op.
      const onlyDeletes = rrsets.every(
        (rrset) => rrset.changetype === "DELETE",
      );
      if (
        onlyDeletes &&
        error instanceof PdnsError &&
        error.status === 404
      ) {
        return;
      }
      throw error;
    }
  }

  // Rebuilds every rrset at `fqdn` from `rows`. Types with rows are
  // REPLACEd with all of their values; every other managed type is
  // DELETEd, so stale values can never survive an edit or delete.
  // The zone apex NS rrset is never touched here: it belongs to the
  // zone itself (callers reject apex NS records).
  async function publishName(
    zone: string,
    fqdn: string,
    rows: DnsRowInput[],
  ): Promise<void> {
    const zoneName = normalizeName(zone);
    const owner = normalizeName(fqdn);
    if (owner !== zoneName && !owner.endsWith(`.${zoneName}`)) {
      throw new PdnsError(
        400,
        `${fqdn} is not inside the DNS zone ${zoneName}`,
      );
    }
    await ensureZone(zoneName);

    const byType = new Map<string, DnsRowInput[]>();
    for (const row of rows) {
      const bucket = byType.get(row.type) ?? [];
      bucket.push(row);
      byType.set(row.type, bucket);
    }

    const rrsets: Rrset[] = [];
    const types = new Set<string>([...DNS_RECORD_TYPES, ...byType.keys()]);
    for (const type of types) {
      if (type === "SOA") {
        continue;
      }
      if (type === "NS" && owner === zoneName) {
        continue;
      }
      const bucket = byType.get(type) ?? [];
      if (bucket.length === 0) {
        rrsets.push({
          name: `${owner}.`,
          type,
          changetype: "DELETE",
        });
        continue;
      }
      rrsets.push({
        name: `${owner}.`,
        type,
        ttl: bucket[bucket.length - 1]?.ttl ?? 300,
        changetype: "REPLACE",
        records: bucket.map((row) => ({
          content: toPowerDnsContent(row.type, row.value),
          disabled: false,
        })),
      });
    }
    await patchRrsets(zoneName, rrsets);
  }

  async function deleteZone(zone: string): Promise<void> {
    const zoneName = normalizeName(zone);
    try {
      await pdnsRequest(`/zones/${encodeURIComponent(`${zoneName}.`)}`, {
        method: "DELETE",
      });
    } catch (error) {
      if (error instanceof PdnsError && error.status === 404) {
        return;
      }
      throw error;
    }
  }

  function defaultLookup(domain: string): Promise<string[]> {
    const resolver = new Resolver();
    const lookup = resolver.resolveNs(domain);
    const timeout = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error("DNS lookup timed out"));
      }, 3000).unref?.();
    });
    return Promise.race([lookup, timeout]);
  }

  // Checks whether the public DNS delegates `domain` to this
  // server's nameservers. A lookup failure is "unknown", never an
  // error: delegation state must never block publishing. Results
  // are cached for 60 seconds per domain; `force` skips the cache.
  async function checkDelegation(
    domain: string,
    options: {
      force?: boolean;
      lookup?: (domain: string) => Promise<string[]>;
    } = {},
  ): Promise<DelegationCheck> {
    const name = normalizeName(domain);
    const checkedAt = new Date().toISOString();
    if (nameservers.length === 0) {
      return { status: "unknown", checkedAt };
    }
    if (!options.force) {
      const cached = delegationCache.get(name);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.check;
      }
    }
    const lookup = options.lookup ?? defaultLookup;
    let status: DelegationState;
    try {
      const answers = await lookup(name);
      const actual = new Set(answers.map(normalizeName));
      status = nameservers.every((ns) => actual.has(ns))
        ? "delegated"
        : "pending";
    } catch {
      status = "unknown";
    }
    const check = { status, checkedAt };
    delegationCache.set(name, {
      check,
      expiresAt: Date.now() + 60_000,
    });
    return check;
  }

  return {
    configured,
    nameservers: () => [...nameservers],
    zoneForDomain: (domain: string) => normalizeName(domain),
    ensureZone,
    publishName,
    deleteZone,
    checkDelegation,
  };
}

export type PowerDnsClient = ReturnType<typeof createPowerDnsClient>;

// Default client, wired to the server config. Routes use this one;
// tests build their own with createPowerDnsClient pointing at a
// mock PowerDNS server.
export const powerDns = createPowerDnsClient();
