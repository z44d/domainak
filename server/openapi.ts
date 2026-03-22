import type { OpenAPIV3 } from "openapi-types";

export const openApiDoc: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "Domainak API",
    version: "1.0.0",
    description:
      "API documentation for Domainak — a free subdomain registration and management service.",
    contact: {
      name: "z44d",
      url: "https://github.com/z44d",
    },
  },
  servers: [
    { url: "http://localhost:2007", description: "Local Development" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained after GitHub OAuth login",
      },
    },
  },
  tags: [
    { name: "Auth", description: "GitHub OAuth authentication" },
    { name: "Domains", description: "User domain management" },
    { name: "Stats", description: "Domain visitor statistics" },
    { name: "Admin", description: "Admin-only moderation endpoints" },
  ],
  paths: {
    // ─── Auth ────────────────────────────────────────────
    "/auth/github": {
      get: {
        tags: ["Auth"],
        summary: "Start GitHub OAuth flow",
        description:
          "Redirects the user to GitHub for authorization. After approval, GitHub redirects back to /auth/callback.",
        responses: {
          "302": {
            description: "Redirect to GitHub OAuth authorization page",
          },
        },
      },
    },
    "/auth/callback": {
      get: {
        tags: ["Auth"],
        summary: "GitHub OAuth callback",
        description:
          "Receives the authorization code from GitHub, exchanges it for an access token, creates/updates the user, and redirects to the frontend with a JWT token.",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Authorization code from GitHub",
          },
        ],
        responses: {
          "302": {
            description:
              "Redirect to frontend /callback?token=JWT on success, or /?error=... on failure",
          },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        description:
          "Returns the authenticated user's profile information.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    githubId: { type: "integer" },
                    name: { type: "string" },
                    email: { type: "string" },
                    avatarUrl: { type: "string" },
                    isAdmin: { type: "boolean" },
                    isBanned: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        description:
          "Logs out the current user. Client should clear localStorage token.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Logout successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                },
              },
            },
          },
        },
      },
    },

    // ─── Domains ─────────────────────────────────────────
    "/domains": {
      get: {
        tags: ["Domains"],
        summary: "List user's domains",
        description:
          "Returns all domains registered by the authenticated user.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "List of domains",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    domains: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer" },
                          subdomain: {
                            type: "string",
                            example: "myapp.domainak.com",
                          },
                          hostname: {
                            type: "string",
                            example: "192.168.1.100",
                          },
                          port: { type: "integer", example: 8080 },
                          userId: { type: "integer" },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Domains"],
        summary: "Register a new subdomain",
        description:
          "Registers a new subdomain pointing to the specified hostname and port.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subdomain", "domain", "hostname", "port"],
                properties: {
                  subdomain: {
                    type: "string",
                    example: "myapp",
                    description: "Subdomain prefix",
                  },
                  domain: {
                    type: "string",
                    example: "domainak.com",
                    description: "Base domain",
                  },
                  hostname: {
                    type: "string",
                    example: "192.168.1.100",
                    description: "Target IP or hostname",
                  },
                  port: {
                    type: "integer",
                    example: 8080,
                    description: "Target port",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Domain registered successfully" },
          "400": {
            description:
              "Missing fields, invalid domain, or subdomain taken",
          },
          "401": { description: "Unauthorized" },
          "403": { description: "IP is banned" },
        },
      },
    },
    "/domains/available": {
      get: {
        tags: ["Domains"],
        summary: "List available base domains",
        description:
          "Returns the list of base domains that users can register subdomains under.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Available domains",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    available: {
                      type: "array",
                      items: { type: "string" },
                      example: ["domainak.com"],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/domains/{id}": {
      delete: {
        tags: ["Domains"],
        summary: "Delete a domain",
        description: "Deletes a domain owned by the authenticated user.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "Domain deleted" },
          "403": { description: "Forbidden — not the owner" },
          "404": { description: "Domain not found" },
        },
      },
    },

    // ─── Stats ───────────────────────────────────────────
    "/stats/increment": {
      get: {
        tags: ["Stats"],
        summary: "Increment visit counter (internal)",
        description:
          "Called internally by Nginx mirror to increment Redis visitor counters. Uses the Host header to identify the domain.",
        parameters: [
          {
            name: "Host",
            in: "header",
            required: true,
            schema: { type: "string" },
            description:
              "The subdomain being visited (e.g. myapp.domainak.com)",
          },
        ],
        responses: {
          "200": { description: "Counter incremented" },
          "400": { description: "Missing Host header" },
        },
      },
    },
    "/stats/{domainId}": {
      get: {
        tags: ["Stats"],
        summary: "Get domain visitor stats",
        description:
          "Returns daily, weekly, monthly, total visitor counts, and a 12-month chart for the requested year.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "domainId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "year",
            in: "query",
            required: false,
            schema: { type: "string", example: "2026" },
            description:
              "Year for the monthly chart data (defaults to current year)",
          },
        ],
        responses: {
          "200": {
            description: "Visitor statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    daily: { type: "integer" },
                    weekly: { type: "integer" },
                    monthly: { type: "integer" },
                    total: { type: "integer" },
                    chartData: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", example: "Jan" },
                          visitors: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden — not the owner" },
          "404": { description: "Domain not found" },
        },
      },
    },

    // ─── Admin ───────────────────────────────────────────
    "/admin/domains": {
      get: {
        tags: ["Admin"],
        summary: "List all domains (admin)",
        description:
          "Returns the 100 most recent domains with their owners. Admin only.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "List of all domains with user info" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden — admins only" },
        },
      },
    },
    "/admin/domains/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Delete any domain (admin)",
        description: "Deletes any domain by ID. Admin only.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "Domain deleted" },
          "403": { description: "Forbidden — admins only" },
          "404": { description: "Domain not found" },
        },
      },
    },
    "/admin/users/{id}/ban": {
      post: {
        tags: ["Admin"],
        summary: "Ban/unban a user (admin)",
        description: "Toggles the banned status of a user. Admin only.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  isBanned: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User ban status updated" },
          "403": { description: "Forbidden — admins only" },
        },
      },
    },
    "/admin/ips/ban": {
      post: {
        tags: ["Admin"],
        summary: "Ban an IP address (admin)",
        description:
          "Bans an IP address from registering domains. Admin only.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ip"],
                properties: {
                  ip: { type: "string", example: "192.168.1.100" },
                  reason: { type: "string", example: "Phishing" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "IP banned" },
          "400": { description: "IP required or already banned" },
          "403": { description: "Forbidden — admins only" },
        },
      },
    },
  },
};
