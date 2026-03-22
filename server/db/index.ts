import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { POSTGRES_URL } from "../config";

const queryClient = postgres(POSTGRES_URL as string);
export const db = drizzle(queryClient);

const MAX_RETRIES = 5;
for (let i = 0; i < MAX_RETRIES; i++) {
  try {
    await migrate(db, { migrationsFolder: "./server/db/migrations" });
    console.log("Database migrations applied successfully.");
    break;
  } catch (error: any) {
    console.error(`Migration failed (attempt ${i + 1}/${MAX_RETRIES}). Retrying in 3 seconds...`);
    if (i === MAX_RETRIES - 1) console.error("Final migration attempt failed:", error);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
