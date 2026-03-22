import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";

export const jwtMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : getCookie(c, "session_token");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return c.json({ error: "Server configuration error" }, 500);
    }
    const payload = await verify(token, secret, "HS256");
    c.set("user", payload);
    await next();
  } catch (_error) {
    return c.json({ error: "Invalid token" }, 401);
  }
};

export const adminMiddleware = async (c: Context, next: Next) => {
  const user = c.get("user") as { isAdmin?: boolean } | undefined;
  if (!user || !user.isAdmin) {
    return c.json({ error: "Forbidden: Admins only" }, 403);
  }
  await next();
};
