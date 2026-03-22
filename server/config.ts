export const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  FRONTEND_URL = "http://localhost:5173",
  POSTGRES_USER = "postgres",
  POSTGRES_PASSWORD = "postgres",
  POSTGRES_DB = "postgres",
  POSTGRES_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`,
} = process.env;
