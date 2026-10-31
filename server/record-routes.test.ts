import { describe, expect, test } from "bun:test";
import {
  type RecordRouteStore,
  recordRouteKey,
  recordRouteTarget,
  removeRecordRoute,
  syncRecordRoute,
} from "./record-routes";

// In-memory stand-in for the Redis route store: the sync code only
// needs set/del, and the real client must never be touched by tests.
function memoryStore(): {
  store: RecordRouteStore;
  entries: Map<string, string>;
} {
  const entries = new Map<string, string>();
  const store: RecordRouteStore = {
    set: async (key, value) => {
      entries.set(key, value);
    },
    del: async (key) => {
      entries.delete(key);
    },
  };
  return { store, entries };
}

describe("recordRouteTarget", () => {
  test("CNAME routes over HTTPS to its target", () => {
    expect(
      recordRouteTarget([{ type: "CNAME", value: "z44d.github.io" }]),
    ).toBe("https://z44d.github.io");
  });

  test("CNAME wins over an A row at the same name", () => {
    expect(
      recordRouteTarget([
        { type: "A", value: "203.0.113.10" },
        { type: "CNAME", value: "app.example.com" },
      ]),
    ).toBe("https://app.example.com");
  });

  test("A routes to the bare address (HTTP, port 80)", () => {
    expect(recordRouteTarget([{ type: "A", value: "203.0.113.10" }])).toBe(
      "203.0.113.10",
    );
  });

  test("AAAA routes bracketed for the proxy", () => {
    expect(
      recordRouteTarget([{ type: "AAAA", value: "2001:db8::1" }]),
    ).toBe("[2001:db8::1]");
  });

  test("A wins over AAAA at the same name", () => {
    expect(
      recordRouteTarget([
        { type: "AAAA", value: "2001:db8::1" },
        { type: "A", value: "203.0.113.10" },
      ]),
    ).toBe("203.0.113.10");
  });

  test("DNS-only types get no proxy route", () => {
    for (const type of [
      "TXT",
      "MX",
      "NS",
      "SRV",
      "CAA",
      "PTR",
      "DS",
      "HTTPS",
      "SVCB",
      "CERT",
      "SSHFP",
      "TLSA",
      "NAPTR",
    ]) {
      expect(
        recordRouteTarget([{ type, value: "anything.example.com" }]),
      ).toBeNull();
    }
  });

  test("no rows means no route", () => {
    expect(recordRouteTarget([])).toBeNull();
  });
});

describe("syncRecordRoute", () => {
  test("writes the route under the record: key", async () => {
    const { store, entries } = memoryStore();
    await syncRecordRoute(
      "tgram.test.z44d.com",
      [{ type: "CNAME", value: "z44d.github.io" }],
      store,
    );
    expect(entries.get(recordRouteKey("tgram.test.z44d.com"))).toBe(
      "https://z44d.github.io",
    );
  });

  test("removes the route when no routable rows remain", async () => {
    const { store, entries } = memoryStore();
    entries.set(
      recordRouteKey("tgram.test.z44d.com"),
      "https://z44d.github.io",
    );
    await syncRecordRoute(
      "tgram.test.z44d.com",
      [{ type: "TXT", value: "hello" }],
      store,
    );
    expect(entries.has(recordRouteKey("tgram.test.z44d.com"))).toBe(false);
  });

  test("a failing store never throws", async () => {
    const failing: RecordRouteStore = {
      set: async () => {
        throw new Error("redis down");
      },
      del: async () => {
        throw new Error("redis down");
      },
    };
    await syncRecordRoute(
      "tgram.test.z44d.com",
      [{ type: "CNAME", value: "z44d.github.io" }],
      failing,
    );
    await removeRecordRoute("tgram.test.z44d.com", failing);
  });
});
