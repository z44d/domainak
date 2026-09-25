// Support for the "subdomain not registered" page served by the proxy.
// That page links back here with `?subdomain=<host>`, and the claim form
// opens with the subdomain prefilled.

const PENDING_CLAIM_KEY = "domainak_pending_claim";

const MAX_LABEL_LENGTH = 63;

function cleanHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/)[0]
    ?.replace(/[^a-z0-9.-]/g, "") ?? "";
}

function cleanLabel(value: string) {
  return value
    .replace(/\.+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LABEL_LENGTH)
    .replace(/-+$/g, "");
}

// Turns a hostname into the subdomain part of a Domainak claim.
export function subdomainFromHost(
  host: string,
  availableDomains: string[],
) {
  const cleanedHost = cleanHost(host);

  if (!cleanedHost) {
    return "";
  }

  const suffix = availableDomains
    .map(cleanHost)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find(
      (domain) =>
        cleanedHost === domain || cleanedHost.endsWith(`.${domain}`),
    );

  if (suffix) {
    return cleanedHost === suffix
      ? ""
      : cleanLabel(cleanedHost.slice(0, -(suffix.length + 1)));
  }

  const [firstLabel = ""] = cleanedHost.split(".");
  return cleanLabel(firstLabel);
}

export function savePendingClaimHost(host: string) {
  const cleanedHost = cleanHost(host);

  if (!cleanedHost) {
    return;
  }

  try {
    localStorage.setItem(PENDING_CLAIM_KEY, cleanedHost);
  } catch {
    // Storage unavailable; the claim form simply opens empty.
  }
}

export function takePendingClaimHost() {
  try {
    const host = localStorage.getItem(PENDING_CLAIM_KEY);
    localStorage.removeItem(PENDING_CLAIM_KEY);
    return host ? cleanHost(host) : "";
  } catch {
    return "";
  }
}
