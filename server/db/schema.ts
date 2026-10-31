import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userTable = pgTable(
  "user",
  {
    id: serial("id").primaryKey(),
    githubId: integer("github_id").notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email").notNull().unique(),
    isBanned: boolean("is_banned").default(false).notNull(),
  },
  (table) => [index("user_is_banned_idx").on(table.isBanned)],
);

export const domainTable = pgTable(
  "domain",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id),
    subdomain: varchar("subdomain", { length: 64 }).notNull().unique(),
    hostname: varchar("hostname", { length: 64 }),
    port: integer("port"),
    targetUrl: varchar("target_url", { length: 500 }),
    mode: varchar("mode", { length: 8 }).default("proxy").notNull(),
    // Per-subdomain access rules, enforced by the edge proxy (see
    // unregistered.lua). geo_mode: "all" (default), "allowlist" (only the
    // selected countries), "blocklist" (every country except the selected).
    geoMode: varchar("geo_mode", { length: 12 }).default("all").notNull(),
    geoCountries: text("geo_countries")
      .array()
      .$type<string[]>()
      .default(sql`'{}'`)
      .notNull(),
    maintenance: boolean("maintenance").default(false).notNull(),
    maintenanceMessage: varchar("maintenance_message", { length: 200 }),
    // Service window: the subdomain only serves traffic between service_start
    // and service_end in `timezone` (IANA name). "24:00" is a valid end value
    // and an equal start/end means around the clock.
    serviceHours: boolean("service_hours").default(false).notNull(),
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
    serviceStart: varchar("service_start", { length: 5 })
      .default("00:00")
      .notNull(),
    serviceEnd: varchar("service_end", { length: 5 })
      .default("24:00")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("domain_user_id_idx").on(table.userId),
    index("domain_created_at_idx").on(table.createdAt),
  ],
);

export const domainStaticTable = pgTable("domain_static", {
  domainId: integer("domain_id")
    .notNull()
    .references(() => domainTable.id),
  totalRequests: integer("total_requests").notNull().default(0),
});

export const domainVisitsTable = pgTable("domain_visits", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id")
    .notNull()
    .references(() => domainTable.id),
  date: date("date").notNull(),
  visitors: integer("visitors").notNull().default(0),
});

export const bannedDomainsTable = pgTable(
  "banned_domains",
  {
    id: serial("id").primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("banned_domains_created_at_idx").on(table.createdAt)],
);

export const bannedIpsTable = pgTable(
  "banned_ips",
  {
    id: serial("id").primaryKey(),
    ip: varchar("ip", { length: 45 }).notNull().unique(),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("banned_ips_created_at_idx").on(table.createdAt)],
);

// DNS records that belong to one registered domain. A record's owner
// name lives under the domain itself: for the domain
// `app.example.com`, "@" is app.example.com, "www" is
// www.app.example.com and "_acme-challenge" is the ACME challenge
// name. Records are published in the domain's own zone in the
// project's PowerDNS server (see routes/domain-records.ts); Postgres
// is the source of truth and `syncStatus` reports whether the
// published copy matches the row. Deleting the domain deletes its
// records.
export const domainDnsRecordsTable = pgTable(
  "domain_dns_record",
  {
    id: serial("id").primaryKey(),
    domainId: integer("domain_id")
      .notNull()
      .references(() => domainTable.id, {
        onDelete: "cascade",
      }),
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id),
    // Fully qualified owner name without a trailing dot, e.g.
    // "www.app.example.com".
    name: varchar("name", { length: 253 }).notNull(),
    type: varchar("type", { length: 10 }).notNull(),
    // Canonical record data, e.g. "10 mail.example.com" for MX.
    value: text("value").notNull(),
    ttl: integer("ttl").default(300).notNull(),
    comment: varchar("comment", { length: 255 }),
    // "synced" (published copy matches), "pending" (never published,
    // for example PowerDNS not configured), "failed" (the
    // last publish attempt errored; see syncError).
    syncStatus: varchar("sync_status", { length: 16 })
      .default("pending")
      .notNull(),
    syncError: text("sync_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("domain_dns_record_domain_id_idx").on(table.domainId),
    index("domain_dns_record_name_idx").on(table.name),
    uniqueIndex("domain_dns_record_unique_idx").on(
      table.domainId,
      table.name,
      table.type,
      table.value,
    ),
  ],
);
