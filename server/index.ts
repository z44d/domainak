import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as config from "./config";
import { openApiDoc } from "./openapi";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { domainsRouter } from "./routes/domains";
import { statsRouter } from "./routes/stats";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }),
);

app.route("/auth", authRouter);
app.route("/domains", domainsRouter);
app.route("/admin", adminRouter);
app.route("/stats", statsRouter);

// Swagger UI & OpenAPI docs
app.get("/doc", (c) => c.json(openApiDoc));
app.get("/swagger", swaggerUI({ url: "/doc" }));

app.get("/", (c) => {
  return c.json({ message: "Domainak API is running" });
});

export default {
  port: process.env.PORT || 2007,
  fetch: app.fetch,
};

console.log(
  `Server running on http://localhost:${process.env.PORT || 2007}`,
);
