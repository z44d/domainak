export const POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
export const POSTGRES_PASSWORD =
  process.env.POSTGRES_PASSWORD || "postgres";
export const POSTGRES_DB = process.env.POSTGRES_DB || "postgres";

// If strictly in Docker (production), force the DB host securely.
// Otherwise, rely heavily on the local .env URL for your local terminal dev environments!
export const POSTGRES_URL =
  process.env.NODE_ENV === "production"
    ? `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`
    : process.env.POSTGRES_URL ||
      `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}`;

export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// PowerDNS HTTP API, the project's own DNS system. Inside Docker the
// service is reachable as `pdns`; local development uses the
// host-published localhost port. DNS records are published here and
// nowhere else: no outside DNS provider is involved.
export const PDNS_API_URL =
  process.env.PDNS_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "http://pdns:8081"
    : "http://localhost:8081");

// Shared with the PowerDNS container (the `api-key` line in
// pdns.conf). The API port is only bound to localhost and the
// internal Docker network.
export const PDNS_API_KEY =
  process.env.PDNS_API_KEY || "domainak-pdns-internal";

// Base domains users can register under. Also the source of the
// default DNS nameservers below when DNS_NAMESERVERS is unset.
const BASE_DOMAINS: string[] = (process.env.DOMAINS || "")
  .split(/[\s,]+/)
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

// Authoritative nameservers for the PowerDNS zones. Each registered
// domain is delegated to these nameservers with NS records in its
// parent zone; they need A (glue) records pointing at this server's
// public IP. Override with DNS_NAMESERVERS (comma/space separated).
export const DNS_NAMESERVERS: string[] = (
  process.env.DNS_NAMESERVERS ||
  (BASE_DOMAINS[0] ? `ns1.${BASE_DOMAINS[0]},ns2.${BASE_DOMAINS[0]}` : "")
)
  .split(/[\s,]+/)
  .map((item) => item.trim().toLowerCase().replace(/\.+$/, ""))
  .filter(Boolean);
