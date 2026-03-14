import axios from "axios";
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as config from "./config";

const app = new Hono();

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = config;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  throw new Error(
    "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required",
  );
}

// Enable CORS for frontend
app.use(
  "*",
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }),
);

// Get GitHub authorization URL
app.get("/auth/github", (c) => {
  const redirectUri = `${config.BACKEND_URL}/auth/callback`;
  const githubAuthUrl = new URL(
    "https://github.com/login/oauth/authorize",
  );
  githubAuthUrl.searchParams.append("client_id", GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.append("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.append("scope", "user:email");

  return c.json({ url: githubAuthUrl.toString() });
});

// Exchange code for token and get user data
app.get("/auth/callback", async (c) => {
  try {
    const code = c.req.query("code");
    const error = c.req.query("error");

    if (error) {
      return c.redirect(`${config.FRONTEND_URL}?error=${error}`);
    }

    if (!code) {
      return c.redirect(`${config.FRONTEND_URL}?error=no_code`);
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return c.redirect(`${config.FRONTEND_URL}?error=no_token`);
    }

    // Get user data
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = {
      id: userResponse.data.id,
      login: userResponse.data.login,
      name: userResponse.data.name,
      bio: userResponse.data.bio,
      avatar_url: userResponse.data.avatar_url,
      email: userResponse.data.email,
    };

    // Encode user data and redirect to frontend
    const userData64 = btoa(JSON.stringify(userData));
    return c.redirect(
      `${config.FRONTEND_URL}/callback?user=${userData64}`,
    );
  } catch (error) {
    console.error("Auth error:", error);
    return c.redirect(`${config.FRONTEND_URL}?error=auth_failed`);
  }
});

// Health check
app.get("/", (c) => {
  return c.json({ message: "GitHub OAuth Backend is running" });
});

export default {
  port: 3000,
  fetch: app.fetch,
};

console.log(`Server running on http://localhost:3000`);
