import { isIP } from "node:net";

// Pure DNS-record validation shared by the per-domain records routes.
// Nothing in this file touches the database or the network, so it can be
// unit-tested without Postgres, Redis or PowerDNS.

export const DNS_RECORD_TYPES = [
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
] as const;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export function isDnsRecordType(value: string): value is DnsRecordType {
  return (DNS_RECORD_TYPES as readonly string[]).includes(value);
}

export const MIN_TTL = 60;
export const MAX_TTL = 86400;
export const DEFAULT_TTL = 300;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): Result<never> {
  return { ok: false, error };
}

// Labels may start with an underscore so names like `_acme-challenge`
// and `_dmarc` fit; everything else follows the usual hostname rules.
const LABEL_PATTERN = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9])?$/;
const MAX_NAME_LENGTH = 253;

function stripTrailingDots(value: string): string {
  return value.replace(/\.+$/, "");
}

export function validateTtl(input: unknown): Result<number> {
  const ttl = Number(input ?? DEFAULT_TTL);
  if (!Number.isInteger(ttl) || ttl < MIN_TTL || ttl > MAX_TTL) {
    return fail(`TTL must be between ${MIN_TTL} and ${MAX_TTL} seconds`);
  }
  return { ok: true, value: ttl };
}

export interface ResolvedName {
  // Fully qualified owner name, no trailing dot.
  fqdn: string;
  // Owner part relative to the domain ("" for the apex, "@" in the UI).
  relative: string;
}

export function resolveRecordName(
  domain: string,
  nameInput: unknown,
): Result<ResolvedName> {
  const base = stripTrailingDots(
    String(domain ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!base) {
    return fail("Invalid domain");
  }
  const raw = stripTrailingDots(
    String(nameInput ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ""),
  );

  let owner = raw;
  if (raw === "@" || raw === "") {
    owner = "";
  } else if (raw === base) {
    owner = "";
  } else if (raw.endsWith(`.${base}`)) {
    owner = raw.slice(0, -(base.length + 1));
  }

  if (owner) {
    for (const label of owner.split(".")) {
      if (!LABEL_PATTERN.test(label)) {
        return fail(
          "Invalid name: use letters, numbers, hyphens " +
            "and underscores",
        );
      }
    }
  }

  const fqdn = owner ? `${owner}.${base}` : base;
  if (fqdn.length > MAX_NAME_LENGTH) {
    return fail("Name is too long");
  }
  return { ok: true, value: { fqdn, relative: owner } };
}

function isHostname(value: string, minLabels: number): boolean {
  if (!value || value.length > MAX_NAME_LENGTH) {
    return false;
  }
  const labels = value.split(".");
  if (labels.length < minLabels) {
    return false;
  }
  return labels.every((label) => LABEL_PATTERN.test(label));
}

function hostnameResult(
  raw: string,
  minLabels: number,
  error: string,
): Result<string> {
  const target = stripTrailingDots(raw.toLowerCase());
  if (!isHostname(target, minLabels)) {
    return fail(error);
  }
  return { ok: true, value: target };
}

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

function integerPart(
  part: string | undefined,
  min: number,
  max: number,
  label: string,
): Result<number> {
  if (part === undefined || !/^\d+$/.test(part)) {
    return fail(`${label} must be a number`);
  }
  const value = Number(part);
  if (value < min || value > max) {
    return fail(`${label} must be between ${min} and ${max}`);
  }
  return { ok: true, value };
}

function hexPart(
  part: string | undefined,
  label: string,
  minLength: number,
): Result<string> {
  if (
    !part ||
    part.length < minLength ||
    part.length % 2 !== 0 ||
    !HEX_PATTERN.test(part)
  ) {
    return fail(`${label} must be hexadecimal data`);
  }
  return { ok: true, value: part.toUpperCase() };
}

// Validates one record value and returns its canonical stored form:
// hostnames without a trailing dot, numbers without leading zeros, TXT
// without surrounding quotes, multi-part types in their wire order.
export function validateRecordValue(
  type: DnsRecordType,
  input: unknown,
): Result<string> {
  const raw = String(input ?? "").trim();

  if (type === "A" || type === "AAAA") {
    const version = type === "A" ? 4 : 6;
    if (isIP(raw) !== version) {
      return fail(`${type} value must be a valid IPv${version} address`);
    }
    return {
      ok: true,
      value: version === 6 ? raw.toLowerCase() : raw,
    };
  }

  if (type === "CNAME" || type === "NS") {
    return hostnameResult(
      raw,
      2,
      `${type} value must be a hostname like app.example.com`,
    );
  }

  if (type === "PTR") {
    return hostnameResult(raw, 1, "PTR value must be a hostname");
  }

  if (type === "TXT") {
    if (!raw || raw.length > 1024) {
      return fail("TXT value must be 1-1024 characters");
    }
    if (raw.includes('"')) {
      return fail("TXT value cannot contain double quotes");
    }
    const hasControlChars = [...raw].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && char !== "\t";
    });
    if (hasControlChars) {
      return fail("TXT value cannot contain control characters");
    }
    return { ok: true, value: raw };
  }

  if (type === "MX") {
    const parts = raw.split(/\s+/);
    const priority = integerPart(parts[0], 0, 65535, "MX priority");
    if (!priority.ok) {
      return priority;
    }
    if (parts.length !== 2) {
      return fail("MX value must be: priority target");
    }
    const target = parts[1];
    if (target === ".") {
      return { ok: true, value: `${priority.value} .` };
    }
    const host = hostnameResult(
      target ?? "",
      1,
      "MX target must be a hostname",
    );
    if (!host.ok) {
      return host;
    }
    return { ok: true, value: `${priority.value} ${host.value}` };
  }

  if (type === "SRV") {
    const parts = raw.split(/\s+/);
    if (parts.length !== 4) {
      return fail("SRV value must be: priority weight port target");
    }
    const priority = integerPart(parts[0], 0, 65535, "SRV priority");
    if (!priority.ok) {
      return priority;
    }
    const weight = integerPart(parts[1], 0, 65535, "SRV weight");
    if (!weight.ok) {
      return weight;
    }
    const port = integerPart(parts[2], 1, 65535, "SRV port");
    if (!port.ok) {
      return port;
    }
    const target = parts[3];
    if (target === ".") {
      return {
        ok: true,
        value: `${priority.value} ${weight.value} ${port.value} .`,
      };
    }
    const host = hostnameResult(
      target ?? "",
      1,
      "SRV target must be a hostname",
    );
    if (!host.ok) {
      return host;
    }
    return {
      ok: true,
      value:
        `${priority.value} ${weight.value} ` +
        `${port.value} ${host.value}`,
    };
  }

  if (type === "CAA") {
    const match = /^(\d{1,3})\s+(issue|issuewild|iodef)\s+"([^"]+)"$/.exec(
      raw,
    );
    if (!match) {
      return fail(
        'CAA value must be: flags tag "value", ' +
          'for example 0 issue "letsencrypt.org"',
      );
    }
    const flags = integerPart(match[1], 0, 255, "CAA flags");
    if (!flags.ok) {
      return flags;
    }
    return {
      ok: true,
      value: `${flags.value} ${match[2]} "${match[3]}"`,
    };
  }

  if (type === "DS") {
    const parts = raw.split(/\s+/);
    if (parts.length !== 4) {
      return fail(
        "DS value must be: key tag, algorithm, digest type, digest",
      );
    }
    const keyTag = integerPart(parts[0], 0, 65535, "DS key tag");
    if (!keyTag.ok) {
      return keyTag;
    }
    const algorithm = integerPart(parts[1], 0, 255, "DS algorithm");
    if (!algorithm.ok) {
      return algorithm;
    }
    const digestType = integerPart(parts[2], 0, 255, "DS digest type");
    if (!digestType.ok) {
      return digestType;
    }
    const digest = hexPart(parts[3], "DS digest", 8);
    if (!digest.ok) {
      return digest;
    }
    return {
      ok: true,
      value:
        `${keyTag.value} ${algorithm.value} ` +
        `${digestType.value} ${digest.value}`,
    };
  }

  if (type === "SSHFP") {
    const parts = raw.split(/\s+/);
    if (parts.length !== 3) {
      return fail(
        "SSHFP value must be: algorithm, fingerprint type, fingerprint",
      );
    }
    const algorithm = integerPart(parts[0], 0, 255, "SSHFP algorithm");
    if (!algorithm.ok) {
      return algorithm;
    }
    const fpType = integerPart(parts[1], 0, 255, "SSHFP fingerprint type");
    if (!fpType.ok) {
      return fpType;
    }
    const fingerprint = hexPart(parts[2], "SSHFP fingerprint", 8);
    if (!fingerprint.ok) {
      return fingerprint;
    }
    return {
      ok: true,
      value: `${algorithm.value} ${fpType.value} ${fingerprint.value}`,
    };
  }

  if (type === "TLSA") {
    const parts = raw.split(/\s+/);
    if (parts.length !== 4) {
      return fail(
        "TLSA value must be: usage, selector, " +
          "matching type, certificate data",
      );
    }
    const usage = integerPart(parts[0], 0, 255, "TLSA usage");
    if (!usage.ok) {
      return usage;
    }
    const selector = integerPart(parts[1], 0, 1, "TLSA selector");
    if (!selector.ok) {
      return selector;
    }
    const matching = integerPart(parts[2], 0, 2, "TLSA matching type");
    if (!matching.ok) {
      return matching;
    }
    const data = hexPart(parts[3], "TLSA data", 2);
    if (!data.ok) {
      return data;
    }
    return {
      ok: true,
      value:
        `${usage.value} ${selector.value} ` +
        `${matching.value} ${data.value}`,
    };
  }

  if (type === "HTTPS" || type === "SVCB") {
    const parts = raw.split(/\s+/);
    if (parts.length < 2) {
      return fail(`${type} value must be: priority target [params]`);
    }
    const priority = integerPart(parts[0], 0, 65535, `${type} priority`);
    if (!priority.ok) {
      return priority;
    }
    const target = parts[1] ?? "";
    let targetValue: string;
    if (target === ".") {
      targetValue = ".";
    } else {
      const host = hostnameResult(
        target,
        1,
        `${type} target must be a hostname or "."`,
      );
      if (!host.ok) {
        return host;
      }
      targetValue = host.value;
    }
    const params = parts.slice(2);
    for (const param of params) {
      if (!/^[a-z0-9-]+(=[^\s]+)?$/.test(param)) {
        return fail(
          `${type} params must look like key=value, ` +
            "for example alpn=h2",
        );
      }
    }
    const rest = params.length > 0 ? ` ${params.join(" ")}` : "";
    return {
      ok: true,
      value: `${priority.value} ${targetValue}${rest}`,
    };
  }

  if (type === "CERT") {
    const parts = raw.split(/\s+/);
    if (parts.length !== 4) {
      return fail(
        "CERT value must be: type, key tag, algorithm, certificate",
      );
    }
    const certType = integerPart(parts[0], 0, 65535, "CERT type");
    if (!certType.ok) {
      return certType;
    }
    const keyTag = integerPart(parts[1], 0, 65535, "CERT key tag");
    if (!keyTag.ok) {
      return keyTag;
    }
    const algorithm = integerPart(parts[2], 0, 255, "CERT algorithm");
    if (!algorithm.ok) {
      return algorithm;
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(parts[3] ?? "")) {
      return fail("CERT certificate must be base64 data");
    }
    return {
      ok: true,
      value:
        `${certType.value} ${keyTag.value} ` +
        `${algorithm.value} ${parts[3]}`,
    };
  }

  // NAPTR: order preference "flags" "service" "regexp" replacement
  const naptr =
    /^(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+"([^"]*)"\s+(\S+)$/.exec(
      raw,
    );
  if (!naptr) {
    return fail(
      'NAPTR value must be: order preference "flags" ' +
        '"service" "regexp" replacement',
    );
  }
  const order = integerPart(naptr[1], 0, 65535, "NAPTR order");
  if (!order.ok) {
    return order;
  }
  const preference = integerPart(naptr[2], 0, 65535, "NAPTR preference");
  if (!preference.ok) {
    return preference;
  }
  const replacement = naptr[6] ?? "";
  let replacementValue: string;
  if (replacement === ".") {
    replacementValue = ".";
  } else {
    const host = hostnameResult(
      replacement,
      1,
      'NAPTR replacement must be a hostname or "."',
    );
    if (!host.ok) {
      return host;
    }
    replacementValue = host.value;
  }
  return {
    ok: true,
    value:
      `${order.value} ${preference.value} "${naptr[3]}" ` +
      `"${naptr[4]}" "${naptr[5]}" ${replacementValue}`,
  };
}

// A CNAME cannot share its owner name with any other record type, and
// no other type can be added under a name that already has a CNAME.
// `rows` are the sibling rows at the same name; `excludeId` skips the
// row being updated.
export function cnameConflictError(
  rows: { id: number; type: string }[],
  type: DnsRecordType,
  excludeId?: number,
): string | null {
  const siblings = rows.filter((row) => row.id !== excludeId);
  if (siblings.length === 0) {
    return null;
  }
  if (type === "CNAME") {
    return "A CNAME cannot share its name with other records";
  }
  if (siblings.some((row) => row.type === "CNAME")) {
    return "This name already has a CNAME record";
  }
  return null;
}

// The host/IP a banned-list check should look at, if any: the record
// value itself for address types, the target host for the types that
// point at one.
export function recordTargetHost(
  type: DnsRecordType,
  value: string,
): string | null {
  if (type === "A" || type === "AAAA" || type === "CNAME") {
    return value;
  }
  if (type === "MX") {
    return value.split(/\s+/)[1] ?? null;
  }
  if (type === "SRV") {
    return value.split(/\s+/)[3] ?? null;
  }
  return null;
}
