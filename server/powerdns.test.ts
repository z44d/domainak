import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
  createPowerDnsClient,
  PdnsError,
  toPowerDnsContent,
} from "./powerdns";

const NS = ["ns1.example.com", "ns2.example.com"];

function client() {
  return createPowerDnsClient({
    baseUrl: "http://pdns.test:8081",
    apiKey: "test-key",
    nameservers: NS,
  });
}

describe("toPowerDnsContent", () => {
  test("address and passthrough types are unchanged", () => {
    expect(toPowerDnsContent("A", "203.0.113.10")).toBe("203.0.113.10");
    expect(toPowerDnsContent("AAAA", "2001:db8::1")).toBe("2001:db8::1");
    expect(toPowerDnsContent("DS", "1 2 3 AABBCCDD")).toBe(
      "1 2 3 AABBCCDD",
    );
    expect(toPowerDnsContent("SSHFP", "1 1 AABBCCDD")).toBe(
      "1 1 AABBCCDD",
    );
    expect(toPowerDnsContent("TLSA", "3 1 1 AABB")).toBe("3 1 1 AABB");
    expect(toPowerDnsContent("CERT", "1 2 3 QUJD")).toBe("1 2 3 QUJD");
    expect(toPowerDnsContent("CAA", '0 issue "letsencrypt.org"')).toBe(
      '0 issue "letsencrypt.org"',
    );
  });

  test("hostname types get a trailing dot", () => {
    expect(toPowerDnsContent("CNAME", "app.example.com")).toBe(
      "app.example.com.",
    );
    expect(toPowerDnsContent("NS", "ns1.example.net")).toBe(
      "ns1.example.net.",
    );
    expect(toPowerDnsContent("PTR", "host.example.com")).toBe(
      "host.example.com.",
    );
  });

  test("MX, SRV, HTTPS/SVCB and NAPTR targets get a dot", () => {
    expect(toPowerDnsContent("MX", "10 mail.example.com")).toBe(
      "10 mail.example.com.",
    );
    expect(toPowerDnsContent("MX", "0 .")).toBe("0 .");
    expect(toPowerDnsContent("SRV", "10 60 443 target.example.com")).toBe(
      "10 60 443 target.example.com.",
    );
    expect(toPowerDnsContent("SRV", "0 0 0 .")).toBe("0 0 0 .");
    expect(toPowerDnsContent("HTTPS", "1 . alpn=h2")).toBe("1 . alpn=h2");
    expect(toPowerDnsContent("SVCB", "1 svc.example.com port=8443")).toBe(
      "1 svc.example.com. port=8443",
    );
    expect(
      toPowerDnsContent(
        "NAPTR",
        '100 50 "s" "SIP+D2U" "!^.*$!sip:info@example.com!" _sip._tcp.example.com',
      ),
    ).toBe(
      '100 50 "s" "SIP+D2U" "!^.*$!sip:info@example.com!" _sip._tcp.example.com.',
    );
    expect(toPowerDnsContent("NAPTR", '100 50 "s" "SIP" "" .')).toBe(
      '100 50 "s" "SIP" "" .',
    );
  });

  test("TXT is quoted and chunked at 255 bytes", () => {
    expect(toPowerDnsContent("TXT", "hello world")).toBe('"hello world"');
    const long = "a".repeat(300);
    const encoded = toPowerDnsContent("TXT", long);
    expect(encoded).toBe(`"${"a".repeat(255)}" "${"a".repeat(45)}"`);
    // Backslashes are escaped so the value round-trips.
    expect(toPowerDnsContent("TXT", "a\\b")).toBe('"a\\\\b"');
    // Multibyte characters are never split mid-character.
    const emojis = "🔥".repeat(100);
    const chunks = toPowerDnsContent("TXT", emojis).split(" ");
    for (const chunk of chunks) {
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(
        257,
      );
    }
    expect(chunks.map((chunk) => chunk.slice(1, -1)).join("")).toBe(
      emojis,
    );
  });
});

type FetchHandler = (
  url: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const originalFetch = globalThis.fetch;
let handler: FetchHandler | null = null;

const fetchStub = ((url: string | URL | Request, init?: RequestInit) => {
  if (!handler) {
    throw new Error("fetch stub has no handler");
  }
  return handler(url, init);
}) as typeof fetch;

globalThis.fetch = fetchStub;

afterEach(() => {
  handler = null;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("PowerDNS client (stubbed fetch)", () => {
  test("ensureZone creates the zone with SOA and NS rrsets", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    handler = async (url, init) => {
      const text = String(url);
      let body: unknown = null;
      if (init?.body) {
        body = JSON.parse(String(init.body));
      }
      calls.push({ url: text, method: init?.method ?? "GET", body });
      if (text.endsWith("/zones")) {
        return jsonResponse({ name: "app.example.com." }, 201);
      }
      return jsonResponse({});
    };

    await client().ensureZone("app.example.com");

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe(
      "http://pdns.test:8081/api/v1/servers/localhost/zones",
    );
    expect(calls[0]?.body).toEqual({
      name: "app.example.com.",
      kind: "Native",
      nameservers: ["ns1.example.com.", "ns2.example.com."],
    });
    const rrsets = (
      calls[1]?.body as { rrsets: { type: string; records: unknown[] }[] }
    ).rrsets;
    expect(rrsets.map((rrset) => rrset.type)).toEqual(["SOA", "NS"]);
    expect(rrsets[0]?.records).toHaveLength(1);
    expect(rrsets[1]?.records).toHaveLength(2);
  });

  test("ensureZone treats 409 as already created and retries after failure", async () => {
    let posts = 0;
    handler = async (url) => {
      if (String(url).endsWith("/zones")) {
        posts += 1;
        if (posts === 1) {
          return new Response("boom", { status: 500 });
        }
        return jsonResponse({}, 409);
      }
      return jsonResponse({});
    };

    const pdns = client();
    await expect(pdns.ensureZone("app.example.com")).rejects.toThrow(
      "boom",
    );
    // The failed creation is forgotten, so the next call retries and
    // the 409 path returns without patching SOA/NS.
    await pdns.ensureZone("app.example.com");
    expect(posts).toBe(2);
  });

  test("publishName rebuilds rrsets and never touches apex NS", async () => {
    const patches: unknown[] = [];
    handler = async (url, init) => {
      const text = String(url);
      if (text.endsWith("/zones")) {
        return jsonResponse({}, 409);
      }
      patches.push(JSON.parse(String(init?.body)));
      return jsonResponse({});
    };

    const pdns = client();
    await pdns.publishName("app.example.com", "www.app.example.com", [
      { type: "A", value: "203.0.113.10", ttl: 300 },
      { type: "A", value: "203.0.113.11", ttl: 300 },
      { type: "TXT", value: "v=spf1 -all", ttl: 600 },
    ]);

    expect(patches).toHaveLength(1);
    const rrsets = (
      patches[0] as {
        rrsets: {
          type: string;
          changetype: string;
          ttl?: number;
          records?: { content: string }[];
        }[];
      }
    ).rrsets;
    const byType = new Map(rrsets.map((rrset) => [rrset.type, rrset]));
    expect(byType.get("A")).toMatchObject({
      changetype: "REPLACE",
      ttl: 300,
      records: [
        { content: "203.0.113.10", disabled: false },
        { content: "203.0.113.11", disabled: false },
      ],
    });
    expect(byType.get("TXT")?.records?.[0]?.content).toBe('"v=spf1 -all"');
    expect(byType.get("TXT")?.ttl).toBe(600);
    // Every other managed type is deleted so stale values cannot
    // survive, but SOA is never emitted.
    expect(byType.get("CNAME")?.changetype).toBe("DELETE");
    expect(byType.get("NS")?.changetype).toBe("DELETE");
    expect(byType.has("SOA")).toBe(false);
    expect(rrsets).toHaveLength(16);

    // At the apex the NS rrset is left alone (it belongs to the zone).
    patches.length = 0;
    await pdns.publishName("app.example.com", "app.example.com", [
      { type: "A", value: "203.0.113.10", ttl: 300 },
    ]);
    const apex = (patches[0] as { rrsets: { type: string }[] }).rrsets.map(
      (rrset) => rrset.type,
    );
    expect(apex).not.toContain("NS");
    expect(apex).toHaveLength(15);
  });

  test("publishName rejects names outside the zone", async () => {
    handler = async () => jsonResponse({}, 409);
    await expect(
      client().publishName("app.example.com", "other.example.net", []),
    ).rejects.toThrow("is not inside the DNS zone");
  });

  test("publishName with no rows deletes every rrset at the name", async () => {
    const patches: unknown[] = [];
    handler = async (url, init) => {
      if (String(url).endsWith("/zones")) {
        return jsonResponse({}, 409);
      }
      patches.push(JSON.parse(String(init?.body)));
      return jsonResponse({});
    };
    await client().publishName(
      "app.example.com",
      "old.app.example.com",
      [],
    );
    const rrsets = (patches[0] as { rrsets: { changetype: string }[] })
      .rrsets;
    expect(rrsets.length).toBeGreaterThan(0);
    expect(rrsets.every((rrset) => rrset.changetype === "DELETE")).toBe(
      true,
    );
  });

  test("a missing zone is fine for a pure delete patch", async () => {
    handler = async (url) => {
      if (String(url).endsWith("/zones")) {
        return jsonResponse({}, 409);
      }
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    };
    await client().publishName("app.example.com", "x.app.example.com", []);
  });

  test("deleteZone swallows 404 and throws other errors", async () => {
    handler = async () =>
      new Response(JSON.stringify({ error: "nope" }), { status: 404 });
    await client().deleteZone("app.example.com");

    handler = async () => new Response("server error", { status: 500 });
    await expect(
      client().deleteZone("app.example.com"),
    ).rejects.toBeInstanceOf(PdnsError);
  });

  test("unreachable PowerDNS becomes a 503 PdnsError", async () => {
    handler = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await client()
      .ensureZone("app.example.com")
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(PdnsError);
    expect((error as PdnsError).status).toBe(503);
    expect((error as PdnsError).message).toContain("unreachable");
  });

  test("JSON error bodies are surfaced, plain text falls back", async () => {
    handler = async (url) => {
      if (String(url).endsWith("/zones")) {
        return new Response(JSON.stringify({ error: "bad key" }), {
          status: 401,
        });
      }
      return jsonResponse({});
    };
    await expect(client().ensureZone("app.example.com")).rejects.toThrow(
      "bad key",
    );
  });
});

describe("checkDelegation", () => {
  test("delegated when every nameserver answers", async () => {
    const check = await client().checkDelegation("app.example.com", {
      lookup: async () => ["ns2.example.com.", "ns1.example.com."],
    });
    expect(check.status).toBe("delegated");
  });

  test("pending when a nameserver is missing", async () => {
    const check = await client().checkDelegation("app.example.com", {
      lookup: async () => ["ns1.example.com."],
    });
    expect(check.status).toBe("pending");
  });

  test("unknown when the lookup fails, and results are cached", async () => {
    let lookups = 0;
    const pdns = client();
    const failing = async (): Promise<string[]> => {
      lookups += 1;
      throw new Error("ENOTFOUND");
    };
    const first = await pdns.checkDelegation("app.example.com", {
      lookup: failing,
    });
    expect(first.status).toBe("unknown");
    const second = await pdns.checkDelegation("app.example.com", {
      lookup: failing,
    });
    expect(second.status).toBe("unknown");
    expect(lookups).toBe(1);

    const forced = await pdns.checkDelegation("app.example.com", {
      force: true,
      lookup: async () => NS,
    });
    expect(forced.status).toBe("delegated");
    expect(lookups).toBe(1);
  });

  test("unknown without a lookup when no nameservers are configured", async () => {
    const pdns = createPowerDnsClient({
      baseUrl: "http://pdns.test:8081",
      apiKey: "test-key",
      nameservers: [],
    });
    let lookups = 0;
    const check = await pdns.checkDelegation("app.example.com", {
      lookup: async () => {
        lookups += 1;
        return NS;
      },
    });
    expect(check.status).toBe("unknown");
    expect(lookups).toBe(0);
  });
});

// End-to-end against a mock PowerDNS HTTP server: the client drives
// the real API surface (zone create, rrset PATCH, zone delete) and
// the server state is asserted after every step.
describe("mock PowerDNS server", () => {
  test("full publish lifecycle", async () => {
    type Record = { content: string; disabled: boolean };
    type Rrset = {
      name: string;
      type: string;
      ttl: number;
      records: Record[];
    };
    const zones = new Map<string, Map<string, Rrset>>();

    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        if (request.headers.get("X-API-Key") !== "test-key") {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
          });
        }
        const parts = url.pathname.split("/zones/");
        const zoneKey = parts[1] ? decodeURIComponent(parts[1]) : null;

        if (request.method === "POST" && !zoneKey) {
          const body = (await request.json()) as { name: string };
          if (zones.has(body.name)) {
            return new Response(JSON.stringify({ error: "exists" }), {
              status: 409,
            });
          }
          zones.set(body.name, new Map());
          return new Response(JSON.stringify({ name: body.name }), {
            status: 201,
          });
        }
        if (!zoneKey || !zones.has(zoneKey)) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
          });
        }
        const rrsets = zones.get(zoneKey);
        if (!rrsets) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
          });
        }
        if (request.method === "GET") {
          return Response.json({
            name: zoneKey,
            rrsets: [...rrsets.values()],
          });
        }
        if (request.method === "DELETE") {
          zones.delete(zoneKey);
          return new Response(null, { status: 204 });
        }
        const body = (await request.json()) as {
          rrsets: {
            name: string;
            type: string;
            ttl?: number;
            changetype: string;
            records?: Record[];
          }[];
        };
        for (const rrset of body.rrsets) {
          const key = `${rrset.name}|${rrset.type}`;
          if (rrset.changetype === "DELETE") {
            rrsets.delete(key);
          } else {
            rrsets.set(key, {
              name: rrset.name,
              type: rrset.type,
              ttl: rrset.ttl ?? 300,
              records: rrset.records ?? [],
            });
          }
        }
        return new Response(null, { status: 204 });
      },
    });

    try {
      // The mock server needs the real fetch, not the stub above.
      globalThis.fetch = originalFetch;
      const pdns = createPowerDnsClient({
        baseUrl: `http://127.0.0.1:${server.port}`,
        apiKey: "test-key",
        nameservers: NS,
      });

      await pdns.ensureZone("app.example.com");
      const zoneAfterCreate = (await fetch(
        `http://127.0.0.1:${server.port}/api/v1/servers/localhost/zones/app.example.com.`,
        { headers: { "X-API-Key": "test-key" } },
      ).then((response) => response.json())) as {
        rrsets: Rrset[];
      };
      expect(
        zoneAfterCreate.rrsets.map((rrset) => rrset.type).sort(),
      ).toEqual(["NS", "SOA"]);

      await pdns.publishName("app.example.com", "www.app.example.com", [
        { type: "A", value: "203.0.113.10", ttl: 300 },
        { type: "MX", value: "10 mail.example.com", ttl: 600 },
        { type: "TXT", value: "hello", ttl: 300 },
      ]);
      const zoneAfterPublish = (await fetch(
        `http://127.0.0.1:${server.port}/api/v1/servers/localhost/zones/app.example.com.`,
        { headers: { "X-API-Key": "test-key" } },
      ).then((response) => response.json())) as {
        rrsets: Rrset[];
      };
      const byType = new Map(
        zoneAfterPublish.rrsets.map((rrset) => [rrset.type, rrset]),
      );
      expect(byType.get("A")?.records).toEqual([
        { content: "203.0.113.10", disabled: false },
      ]);
      expect(byType.get("MX")?.records).toEqual([
        { content: "10 mail.example.com.", disabled: false },
      ]);
      expect(byType.get("TXT")?.records).toEqual([
        { content: '"hello"', disabled: false },
      ]);

      // Republishing with fewer rows removes the stale rrsets.
      await pdns.publishName("app.example.com", "www.app.example.com", [
        { type: "A", value: "203.0.113.11", ttl: 300 },
      ]);
      const zoneAfterRebuild = (await fetch(
        `http://127.0.0.1:${server.port}/api/v1/servers/localhost/zones/app.example.com.`,
        { headers: { "X-API-Key": "test-key" } },
      ).then((response) => response.json())) as {
        rrsets: Rrset[];
      };
      const typesAfter = zoneAfterRebuild.rrsets.map(
        (rrset) => rrset.type,
      );
      expect(typesAfter).toContain("A");
      expect(typesAfter).not.toContain("MX");
      expect(typesAfter).not.toContain("TXT");

      await pdns.deleteZone("app.example.com");
      const gone = await fetch(
        `http://127.0.0.1:${server.port}/api/v1/servers/localhost/zones/app.example.com.`,
        { headers: { "X-API-Key": "test-key" } },
      );
      expect(gone.status).toBe(404);
    } finally {
      globalThis.fetch = fetchStub;
      server.stop();
    }
  });
});
