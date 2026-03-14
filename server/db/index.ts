import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import { POSTGRES_URL } from "../config"

const queryClient = postgres(POSTGRES_URL as string)
export const db = drizzle(queryClient)

await migrate(db, { migrationsFolder: "./server/db/migrations" })
