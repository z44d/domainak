import { integer, pgTable, serial, varchar } from "drizzle-orm/pg-core"

export const userTable = pgTable("user", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 32 }).notNull(),
  email: varchar("email").notNull().unique(),
})

export const domainTable = pgTable("domain", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => userTable.id),
  subdomain: varchar("subdomain", { length: 64 }).notNull().unique(),
  hostname: varchar("hostname", { length: 64 }).notNull(),
  port: integer("port").notNull(),
})

export const domainStaticTable = pgTable("domain_static", {
  domainId: serial("domain_id").notNull().references(() => domainTable.id),
  totalRequests: integer("total_requests").notNull(),
})