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
const apiRouter = new Hono();

function registerApiRoutes(router: Hono) {
  router.route("/auth", authRouter);
  router.route("/domains", domainsRouter);
  router.route("/admin", adminRouter);
  router.route("/stats", statsRouter);

  router.get("/doc", (c) => c.json(openApiDoc));
  router.get("/swagger", swaggerUI({ url: "/doc" }));
}

app.use(
  "*",
  cors({
    origin: config.WEBSITE_URL,
    credentials: true,
  }),
);

registerApiRoutes(app);
registerApiRoutes(apiRouter);
app.route("/api", apiRouter);

app.get("/", (c) => {
  return c.json({ message: "Domainak API is running" });
});

app.get("/api", (c) => {
  return c.json({ message: "Domainak API is running" });
});

export default {
  port: process.env.PORT || 2007,
  fetch: app.fetch,
};

console.log(
  `Server running on http://localhost:${process.env.PORT || 2007}`,
);
