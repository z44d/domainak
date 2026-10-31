import type { DnsRecordType } from "./types";

export const DNS_RECORD_TYPES: DnsRecordType[] = [
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
];

// Chip colour per record type. Kept in one place so the list, the form
// type picker and any future record UI stay consistent.
export const TYPE_COLOR: Record<
  DnsRecordType,
  | "default"
  | "primary"
  | "secondary"
  | "error"
  | "info"
  | "success"
  | "warning"
> = {
  A: "primary",
  AAAA: "info",
  CNAME: "success",
  TXT: "warning",
  MX: "secondary",
  NS: "default",
  SRV: "info",
  CAA: "warning",
  PTR: "default",
  DS: "error",
  HTTPS: "primary",
  SVCB: "primary",
  CERT: "secondary",
  SSHFP: "default",
  TLSA: "error",
  NAPTR: "secondary",
};

export interface DnsTypeMeta {
  placeholder: string;
  helper: string;
  example: string;
}

export const TYPE_META: Record<DnsRecordType, DnsTypeMeta> = {
  A: {
    placeholder: "203.0.113.10",
    helper: "IPv4 address this name resolves to.",
    example: "203.0.113.10",
  },
  AAAA: {
    placeholder: "2001:db8::1",
    helper: "IPv6 address this name resolves to.",
    example: "2001:db8::1",
  },
  CNAME: {
    placeholder: "myapp.github.io",
    helper: "Another hostname this name points to. A CNAME cannot share its name with other records.",
    example: "myapp.github.io",
  },
  TXT: {
    placeholder: "v=spf1 -all",
    helper: "Verification or policy text, up to 1024 characters.",
    example: "v=spf1 -all",
  },
  MX: {
    placeholder: "10 mail.example.com",
    helper: "Mail exchanger: lower priority numbers are tried first.",
    example: "10 mail.example.com",
  },
  NS: {
    placeholder: "ns1.example.com",
    helper: "Nameserver that answers for this name.",
    example: "ns1.example.com",
  },
  SRV: {
    placeholder: "10 60 443 target.example.com",
    helper: "Service record: priority, weight, port, then target.",
    example: "10 60 443 target.example.com",
  },
  CAA: {
    placeholder: '0 issue "letsencrypt.org"',
    helper: "Which certificate authorities may issue for this name.",
    example: '0 issue "letsencrypt.org"',
  },
  PTR: {
    placeholder: "host.example.com",
    helper: "Hostname this address reverses to.",
    example: "host.example.com",
  },
  DS: {
    placeholder: "2371 13 2 9F2F2A...",
    helper: "Delegation signer: key tag, algorithm, digest type, digest.",
    example: "2371 13 2 ABCDEF0123456789",
  },
  HTTPS: {
    placeholder: "1 . alpn=h2",
    helper: "HTTPS service binding: priority, target, then parameters.",
    example: "1 . alpn=h2",
  },
  SVCB: {
    placeholder: "1 svc.example.com port=8443",
    helper: "Service binding: priority, target, then parameters.",
    example: "1 svc.example.com port=8443",
  },
  CERT: {
    placeholder: "1 12345 8 MIIB...",
    helper: "Certificate record: type, key tag, algorithm, base64 data.",
    example: "1 12345 8 MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A",
  },
  SSHFP: {
    placeholder: "1 1 123456789ABCDEF...",
    helper: "SSH fingerprint: algorithm, fingerprint type, fingerprint.",
    example: "1 1 123456789ABCDEF123456789ABCDEF12345678",
  },
  TLSA: {
    placeholder: "3 1 1 9F2F2A...",
    helper: "TLS association: usage, selector, matching type, data.",
    example: "3 1 1 ABCDEF0123456789ABCDEF0123456789",
  },
  NAPTR: {
    placeholder: '100 10 "S" "SIP+D2U" "" _sip._tcp.example.com',
    helper: "Naming authority pointer for service discovery.",
    example: '100 10 "S" "SIP+D2U" "" _sip._tcp.example.com',
  },
};

// The structured field sets the form renders instead of one raw value
// box. Every other type uses the single value field.
export type StructuredKind =
  | "mx"
  | "srv"
  | "caa"
  | "ds"
  | "sshfp"
  | "tlsa"
  | "https";

export const STRUCTURED_KIND: Partial<Record<DnsRecordType, StructuredKind>> =
  {
    MX: "mx",
    SRV: "srv",
    CAA: "caa",
    DS: "ds",
    SSHFP: "sshfp",
    TLSA: "tlsa",
    HTTPS: "https",
    SVCB: "https",
  };

export const STRUCTURED_DEFAULTS: Record<StructuredKind, string[]> = {
  mx: ["10", ""],
  srv: ["10", "60", "443", ""],
  caa: ["0", "issue", ""],
  ds: ["", "", "", ""],
  sshfp: ["1", "1", ""],
  tlsa: ["3", "1", "1", ""],
  https: ["1", ".", ""],
};

const STRUCTURED_KEYS: Record<StructuredKind, string[]> = {
  mx: ["priority", "target"],
  srv: ["priority", "weight", "port", "target"],
  caa: ["flags", "tag", "value"],
  ds: ["keyTag", "algorithm", "digestType", "digest"],
  sshfp: ["algorithm", "fingerprintType", "fingerprint"],
  tlsa: ["usage", "selector", "matchingType", "data"],
  https: ["priority", "target", "params"],
};

function structuredFields(
  kind: StructuredKind,
  value: string,
): Record<string, string> {
  const keys = STRUCTURED_KEYS[kind];
  const parts = value.trim().split(/\s+/);
  const fields: Record<string, string> = {};
  if (kind === "caa") {
    const match =
      /^(\d{1,3})\s+(issue|issuewild|iodef)\s+"([^"]*)"$/.exec(
        value.trim(),
      );
    fields.flags = match?.[1] ?? STRUCTURED_DEFAULTS.caa[0] ?? "0";
    fields.tag = match?.[2] ?? "issue";
    fields.value = match?.[3] ?? "";
    return fields;
  }
  if (kind === "https") {
    fields.priority = parts[0] ?? "1";
    fields.target = parts[1] ?? ".";
    fields.params = parts.slice(2).join(" ");
    return fields;
  }
  keys.forEach((key, index) => {
    fields[key] = parts[index] ?? "";
  });
  return fields;
}

// Splits a stored canonical value back into the form's fields so an
// edit starts from the same structured inputs used to create it. When
// the value does not parse, the raw value is returned under `value`
// and the form falls back to the single-field editor.
export function parseRecordValue(
  type: DnsRecordType,
  value: string,
): Record<string, string> {
  const kind = STRUCTURED_KIND[type];
  if (!kind) {
    return { value };
  }
  const fields = structuredFields(kind, value);
  const keys = STRUCTURED_KEYS[kind];
  const looksStructured =
    kind === "caa"
      ? value.includes('"')
      : keys.every((key) => fields[key] !== undefined);
  if (!looksStructured) {
    return { value };
  }
  return fields;
}

// Builds the canonical value the server validates, from the form's
// fields. Structured kinds join their parts; CAA quotes its value.
export function composeRecordValue(
  type: DnsRecordType,
  fields: Record<string, string>,
): string {
  const kind = STRUCTURED_KIND[type];
  if (!kind) {
    return (fields.value ?? "").trim();
  }
  if (kind === "caa") {
    return `${fields.flags ?? "0"} ${fields.tag ?? "issue"} "${fields.value ?? ""}"`;
  }
  if (kind === "https") {
    const params = (fields.params ?? "").trim();
    return `${fields.priority ?? "1"} ${fields.target ?? "."}${params ? ` ${params}` : ""}`.trim();
  }
  return STRUCTURED_KEYS[kind]
    .map((key) => (fields[key] ?? "").trim())
    .join(" ")
    .trim();
}

export function defaultFieldsFor(
  type: DnsRecordType,
): Record<string, string> {
  const kind = STRUCTURED_KIND[type];
  if (!kind) {
    return { value: "" };
  }
  const fields: Record<string, string> = {};
  STRUCTURED_KEYS[kind].forEach((key, index) => {
    fields[key] =
      STRUCTURED_DEFAULTS[kind][index] ?? "";
  });
  return fields;
}

// Shows the owner name relative to its domain: "@" for the domain
// itself, "www" for www.<domain>.
export function relativeName(
  fqdn: string,
  domain: string,
): string {
  if (fqdn === domain) {
    return "@";
  }
  const suffix = `.${domain}`;
  if (fqdn.endsWith(suffix)) {
    return fqdn.slice(0, -suffix.length);
  }
  return fqdn;
}

// The fully qualified name a typed name resolves to, shown live under
// the name field while the user types.
export function previewFqdn(name: string, domain: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed || trimmed === "@") {
    return domain;
  }
  if (trimmed === domain || trimmed.endsWith(`.${domain}`)) {
    return trimmed;
  }
  return `${trimmed}.${domain}`;
}
