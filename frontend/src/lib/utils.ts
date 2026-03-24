import axios from "axios";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export function getErrorMessage(error: unknown, fallback: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try again.";
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const apiMessage = error.response?.data?.error;

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

    if (error.code === "ECONNABORTED") {
      return "The request timed out. Try again.";
    }
  }

  return fallback;
}
