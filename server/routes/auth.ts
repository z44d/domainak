import axios from "axios";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import * as config from "../config";
import { db } from "../db";
import { userTable } from "../db/schema";
import { jwtMiddleware } from "../middleware/auth";

export const authRouter = new Hono<{ Variables: { user: any } }>();

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = config;

authRouter.get("/github", (c) => {
  const url = new URL(c.req.url);
  const redirectUri = `${url.origin}/auth/callback`;
  const githubAuthUrl = new URL(
    "https://github.com/login/oauth/authorize",
  );
  githubAuthUrl.searchParams.append(
    "client_id",
    GITHUB_CLIENT_ID as string,
  );
  githubAuthUrl.searchParams.append("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.append("scope", "user:email");

  return c.redirect(githubAuthUrl.toString());
});

authRouter.get("/callback", async (c) => {
  try {
    const code = c.req.query("code");
    const error = c.req.query("error");

    if (error) {
      return c.redirect(`${config.FRONTEND_URL}?error=${error}`);
    }

    if (!code) {
      return c.redirect(`${config.FRONTEND_URL}?error=no_code`);
    }

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } },
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      return c.redirect(`${config.FRONTEND_URL}?error=no_token`);
    }

    const userResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userData = {
      githubId: userResponse.data.id,
      name: userResponse.data.name || userResponse.data.login,
      email:
        userResponse.data.email ||
        `${userResponse.data.login}@users.noreply.github.com`,
      avatarUrl: userResponse.data.avatar_url,
    };

    let user: any;
    const existingUsers = await db
      .select()
      .from(userTable)
      .where(eq(userTable.githubId, userData.githubId));

    if (existingUsers.length === 0) {
      const inserted = await db
        .insert(userTable)
        .values({
          githubId: userData.githubId,
          name: userData.name,
          email: userData.email,
          avatarUrl: userData.avatarUrl,
          isBanned: false,
        })
        .returning();
      // biome-ignore lint/style/noNonNullAssertion: Guaranteed array index
      user = inserted[0]!;
    } else {
      // biome-ignore lint/style/noNonNullAssertion: Guaranteed array index
      user = existingUsers[0]!;
      if (user.isBanned) {
        return c.redirect(`${config.FRONTEND_URL}?error=banned`);
      }
      const updated = await db
        .update(userTable)
        .set({
          name: userData.name,
          email: userData.email,
          avatarUrl: userData.avatarUrl,
        })
        .where(eq(userTable.id, user.id))
        .returning();
      // biome-ignore lint/style/noNonNullAssertion: Guaranteed array index
      user = updated[0]!;
    }

    const adminIds = process.env.ADMIN_IDS
      ? process.env.ADMIN_IDS.split(",")
      : [];
    const isAdmin = adminIds.includes(String(user.githubId));

    const secret = process.env.JWT_SECRET || "super-secret";
    const payload = {
      id: user.id,
      githubId: user.githubId,
      isAdmin,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    };
    const token = await sign(payload, secret);

    return c.redirect(`${config.FRONTEND_URL}/callback?token=${token}`);
  } catch (error) {
    console.error("Auth error:", error);
    return c.redirect(`${config.FRONTEND_URL}?error=auth_failed`);
  }
});

authRouter.post("/logout", (c) => {
  return c.json({ success: true });
});

authRouter.get("/me", jwtMiddleware, async (c) => {
  const userPayload = c.get("user");
  const dbUser = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userPayload.id));
  if (dbUser.length === 0) return c.json({ error: "User not found" }, 404);

  return c.json({
    id: dbUser[0]?.id,
    githubId: dbUser[0]?.githubId,
    name: dbUser[0]?.name,
    email: dbUser[0]?.email,
    avatarUrl: dbUser[0]?.avatarUrl,
    isAdmin: userPayload.isAdmin,
    isBanned: dbUser[0]?.isBanned,
  });
});
