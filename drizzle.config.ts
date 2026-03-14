import { defineConfig } from "drizzle-kit"
import { POSTGRES_URL } from "./server/config"

export default defineConfig({
  dbCredentials: {
    url: POSTGRES_URL,
  },
  out: "./server/db/migrations",
  schema: "./server/db/schema.ts",
  dialect: "postgresql",
})