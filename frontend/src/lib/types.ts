export interface User {
  id: number;
  name: string;
  email: string;
  githubId: number;
  isAdmin: boolean;
  isBanned: boolean;
}

// Country policy of a route: "all" lets every country through, while
// "allowlist" serves only the selected countries and "blocklist" serves
// every country except them.
export type GeoMode = "all" | "allowlist" | "blocklist";

// Server-computed view of a route's service window. The local wall-clock
// range is what the owner configured; the UTC bounds and the offset label are
// derived on the server from the IANA timezone, so the client never has to
// trust its own clock for the authoritative conversion.
export interface ServiceWindow {
  timezone: string;
  start: string;
  end: string;
  offsetMinutes: number;
  offsetLabel: string;
  utcStart: string;
  utcEnd: string;
}

// Payload of PUT /domains/:id/settings. Country codes are stored as the
// two-letter values the edge proxy compares against CF-IPCountry. Declared as
// a type alias so it can be passed straight to the JSON body helpers.
export type DomainRulesPayload = {
  geoMode: GeoMode;
  countries: string[];
  maintenance: boolean;
  maintenanceMessage: string;
  serviceHours: boolean;
  timezone: string;
  start: string;
  end: string;
};

export interface Domain {
  id: number;
  subdomain: string;
  hostname: string | null;
  port: number | null;
  targetUrl?: string | null;
  mode?: "proxy" | "redirect";
  geoMode?: GeoMode;
  geoCountries?: string[];
  maintenance?: boolean;
  maintenanceMessage?: string | null;
  serviceHours?: boolean;
  timezone?: string;
  serviceStart?: string;
  serviceEnd?: string;
  serviceWindow?: ServiceWindow | null;
  createdAt?: string;
  user?: User | null;
  // Number of DNS records stored for this domain (from GET /domains).
  recordCount?: number;
}

// DNS records for one registered domain. Records live under the domain
// itself (@ is the domain, "www" is www.<domain>) and are published in
// the domain's own zone in the project's PowerDNS server. syncStatus
// reports whether the published copy matches the row: "synced",
// "pending" (never published, for example PowerDNS not configured)
// or "failed" (the last publish attempt errored; see syncError and
// retry). Records only resolve publicly once the domain is delegated
// to the nameservers in DomainRecordsResponse.delegation.
export type DnsRecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "TXT"
  | "MX"
  | "NS"
  | "SRV"
  | "CAA"
  | "PTR"
  | "DS"
  | "HTTPS"
  | "SVCB"
  | "CERT"
  | "SSHFP"
  | "TLSA"
  | "NAPTR";

export type DnsSyncStatus = "synced" | "pending" | "failed";

export interface DomainDnsRecord {
  id: number;
  domainId: number;
  userId: number;
  // Fully qualified name without a trailing dot, e.g.
  // "www.app.example.com".
  name: string;
  type: DnsRecordType;
  // Canonical record data, e.g. "10 mail.example.com" for MX.
  value: string;
  ttl: number;
  comment?: string | null;
  syncStatus: DnsSyncStatus;
  syncError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type DnsDelegationStatus = "delegated" | "pending" | "unknown";

export interface DnsDelegationInfo {
  status: DnsDelegationStatus;
  checkedAt: string;
}

// Payload of GET /domains/:id/records.
export interface DomainRecordsResponse {
  domain: string;
  dnsConfigured: boolean;
  nameservers: string[];
  delegation: DnsDelegationInfo;
  records: DomainDnsRecord[];
}

// Body of POST /domains/:id/records and PUT
// /domains/:id/records/:recordId. `name` may be "@", relative
// ("www", "_acme-challenge") or a full name inside the domain.
export interface DomainDnsRecordPayload {
  name: string;
  type: DnsRecordType;
  value: string;
  ttl: number;
  comment?: string | null;
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  githubId: number;
  isBanned: boolean;
  domainCount: number;
}

// One row of the admin DNS records inventory (GET /admin/dns-records):
// the record itself, the domain it belongs to, and its owner.
export interface AdminDnsRecordRow {
  id: number;
  name: string;
  type: DnsRecordType;
  value: string;
  ttl: number;
  syncStatus: DnsSyncStatus;
  domain: string | null;
  createdAt?: string;
  user: {
    id: number | null;
    name: string | null;
    email: string | null;
    githubId: number | null;
    isBanned: boolean | null;
  } | null;
}

export interface BannedDomain {
  id: number;
  domain: string;
  reason: string | null;
  createdAt: string;
}

export interface BannedIp {
  id: number;
  ip: string;
  reason: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface Stats {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
  chartData: { name: string; visitors: number }[];
}
