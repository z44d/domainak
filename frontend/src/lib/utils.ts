import { ApiError } from "./api";

export function getUserLocale() {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return "en-US";
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(getUserLocale(), options).format(value);
}

export function formatDate(value: string | number | Date) {
  return new Intl.DateTimeFormat(getUserLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try again.";
  }

  if (error instanceof ApiError) {
    const status = error.status;
    const apiMessage =
      typeof error.data === "object" && error.data !== null
        ? (error.data as { error?: unknown }).error
        : undefined;

    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage;
    }

    if (status === 400)
      return "Check the highlighted details and try again.";
    if (status === 401)
      return "Your session expired. Sign in again to continue.";
    if (status === 403) return "You do not have permission to do that.";
    if (status === 404) return "That item no longer exists.";
    if (status === 429)
      return "Too many requests. Wait a moment, then try again.";
    if ((status ?? 0) >= 500) {
      return "The server hit a problem. Try again in a moment.";
    }

    return fallback;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return fallback;
  }

  return fallback;
}
