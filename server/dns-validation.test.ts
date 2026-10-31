import { describe, expect, test } from "bun:test";
import {
  cnameConflictError,
  isDnsRecordType,
  recordTargetHost,
  resolveRecordName,
  validateRecordValue,
  validateTtl,
} from "./dns-validation";

describe("resolveRecordName", () => {
  test("@ resolves to the domain itself", () => {
    expect(resolveRecordName("app.example.com", "@")).toEqual({
      ok: true,
      value: { fqdn: "app.example.com", relative: "" },
    });
  });

  test("relative names resolve under the domain", () => {
    expect(resolveRecordName("app.example.com", "www")).toEqual({
      ok: true,
      value: { fqdn: "www.app.example.com", relative: "www" },
    });
    expect(
      resolveRecordName("app.example.com", "_acme-challenge"),
    ).toEqual({
      ok: true,
      value: {
        fqdn: "_acme-challenge.app.example.com",
        relative: "_acme-challenge",
      },
    });
  });

  test("a full name inside the domain is accepted", () => {
    expect(
      resolveRecordName("app.example.com", "api.app.example.com"),
    ).toEqual({
      ok: true,
      value: { fqdn: "api.app.example.com", relative: "api" },
    });
  });

  test("invalid labels are rejected", () => {
    const result = resolveRecordName("app.example.com", "bad name!");
    expect(result.ok).toBe(false);
  });
});

describe("validateTtl", () => {
  test("defaults to 300", () => {
    expect(validateTtl(undefined)).toEqual({ ok: true, value: 300 });
  });

  test("rejects out-of-range values", () => {
    expect(validateTtl(30).ok).toBe(false);
    expect(validateTtl(90000).ok).toBe(false);
    expect(validateTtl("abc").ok).toBe(false);
  });
});

describe("validateRecordValue", () => {
  test("A and AAAA validate IP versions", () => {
    expect(validateRecordValue("A", "203.0.113.10")).toEqual({
      ok: true,
      value: "203.0.113.10",
    });
    expect(validateRecordValue("A", "2001:db8::1").ok).toBe(false);
    expect(validateRecordValue("AAAA", "2001:DB8::1")).toEqual({
      ok: true,
      value: "2001:db8::1",
    });
    expect(validateRecordValue("AAAA", "203.0.113.10").ok).toBe(false);
  });

  test("CNAME and NS require hostnames", () => {
    expect(validateRecordValue("CNAME", "app.example.com.")).toEqual({
      ok: true,
      value: "app.example.com",
    });
    expect(validateRecordValue("CNAME", "single").ok).toBe(false);
  });

  test("TXT rejects quotes and stays within limits", () => {
    expect(validateRecordValue("TXT", 'say "hi"').ok).toBe(false);
    expect(validateRecordValue("TXT", "v=spf1 -all")).toEqual({
      ok: true,
      value: "v=spf1 -all",
    });
  });

  test("MX canonicalises priority and target", () => {
    expect(validateRecordValue("MX", "10 mail.example.com")).toEqual({
      ok: true,
      value: "10 mail.example.com",
    });
    expect(validateRecordValue("MX", "10 mail.example.com.")).toEqual({
      ok: true,
      value: "10 mail.example.com",
    });
    expect(validateRecordValue("MX", "99999 mail.example.com").ok).toBe(
      false,
    );
    expect(validateRecordValue("MX", "mail.example.com").ok).toBe(false);
    expect(validateRecordValue("MX", "0 .")).toEqual({
      ok: true,
      value: "0 .",
    });
  });

  test("SRV requires four parts", () => {
    expect(
      validateRecordValue("SRV", "10 60 443 target.example.com"),
    ).toEqual({
      ok: true,
      value: "10 60 443 target.example.com",
    });
    expect(validateRecordValue("SRV", "10 60 target").ok).toBe(false);
    expect(
      validateRecordValue("SRV", "10 60 0 target.example.com").ok,
    ).toBe(false);
  });

  test("CAA requires quoted value", () => {
    expect(
      validateRecordValue("CAA", '0 issue "letsencrypt.org"'),
    ).toEqual({
      ok: true,
      value: '0 issue "letsencrypt.org"',
    });
    expect(validateRecordValue("CAA", "0 issue letsencrypt.org").ok).toBe(
      false,
    );
    expect(
      validateRecordValue("CAA", '300 issue "letsencrypt.org"').ok,
    ).toBe(false);
  });

  test("DS, SSHFP and TLSA validate hex data", () => {
    expect(
      validateRecordValue("DS", "2371 13 2 ABCDEF0123456789"),
    ).toEqual({
      ok: true,
      value: "2371 13 2 ABCDEF0123456789",
    });
    expect(validateRecordValue("DS", "2371 13 2 ZZZ").ok).toBe(false);
    expect(
      validateRecordValue(
        "SSHFP",
        "1 1 123456789ABCDEF123456789ABCDEF12345678",
      ).ok,
    ).toBe(true);
    expect(validateRecordValue("TLSA", "3 1 1 ABCDEF0123456789").ok).toBe(
      true,
    );
    expect(validateRecordValue("TLSA", "3 5 1 ABCDEF0123456789").ok).toBe(
      false,
    );
  });

  test("HTTPS and SVCB validate priority, target and params", () => {
    expect(validateRecordValue("HTTPS", "1 . alpn=h2")).toEqual({
      ok: true,
      value: "1 . alpn=h2",
    });
    expect(
      validateRecordValue("SVCB", "1 svc.example.com port=8443"),
    ).toEqual({
      ok: true,
      value: "1 svc.example.com port=8443",
    });
    expect(validateRecordValue("HTTPS", "1").ok).toBe(false);
  });

  test("CERT and NAPTR validate their shapes", () => {
    expect(
      validateRecordValue(
        "CERT",
        "1 12345 8 MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A",
      ).ok,
    ).toBe(true);
    expect(validateRecordValue("CERT", "1 12345 8 not-base64!").ok).toBe(
      false,
    );
    expect(
      validateRecordValue(
        "NAPTR",
        '100 10 "S" "SIP+D2U" "" _sip._tcp.example.com',
      ).ok,
    ).toBe(true);
  });

  test("every supported type is recognised", () => {
    for (const type of [
      "A",
      "AAAA",
      "CNAME",
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
      expect(isDnsRecordType(type)).toBe(true);
    }
    expect(isDnsRecordType("SOA")).toBe(false);
    expect(isDnsRecordType("A" as string)).toBe(true);
  });
});

describe("cnameConflictError", () => {
  test("CNAME cannot join other records at a name", () => {
    expect(cnameConflictError([{ id: 1, type: "A" }], "CNAME")).toBe(
      "A CNAME cannot share its name with other records",
    );
    expect(cnameConflictError([{ id: 1, type: "CNAME" }], "A")).toBe(
      "This name already has a CNAME record",
    );
    expect(cnameConflictError([{ id: 1, type: "A" }], "AAAA")).toBeNull();
    expect(
      cnameConflictError([{ id: 1, type: "CNAME" }], "A", 1),
    ).toBeNull();
  });
});

describe("recordTargetHost", () => {
  test("returns the pointed-at host for target types", () => {
    expect(recordTargetHost("A", "203.0.113.10")).toBe("203.0.113.10");
    expect(recordTargetHost("MX", "10 mail.example.com")).toBe(
      "mail.example.com",
    );
    expect(recordTargetHost("SRV", "10 60 443 target.example.com")).toBe(
      "target.example.com",
    );
    expect(recordTargetHost("TXT", "hello")).toBeNull();
  });
});
