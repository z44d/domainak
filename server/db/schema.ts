import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
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
