const RAW_BASE =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://127.0.0.1:8000";

export const API_BASE_URL = RAW_BASE.replace(/\/+$/, "");

const TOKEN_KEY = "cas.access_token";
const USER_KEY = "cas.user";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY);
  },
  set(token: string, remember: boolean) {
    if (typeof window === "undefined") return;
    const store = remember ? window.localStorage : window.sessionStorage;
    store.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function humanMessage(status: number, detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
      return field ? `${String(field)}: ${first.msg}` : first.msg;
    }
  }
  switch (status) {
    case 400:
      return "The request was invalid. Please check the values you entered.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 409:
      return "That record already exists.";
    case 422:
      return "Some fields are invalid. Please review the form.";
    case 500:
      return "The server ran into a problem. Please try again shortly.";
    default:
      return `Request failed (${status}).`;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
  signal?: AbortSignal;
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, auth = true, signal } = options;
  const headers: Record<string, string> = {};

  if (auth) {
    const token = tokenStore.get();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  // NOTE: never set Content-Type for FormData — the browser adds the boundary.
  if (body !== undefined && !formData) headers["Content-Type"] = "application/json";

  const requestBody: BodyInit | null =
    formData ?? (body !== undefined ? JSON.stringify(body) : null);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal: signal ?? null,
      body: requestBody,
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the API at ${API_BASE_URL}. Make sure the backend is running and reachable from this browser.`,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in (payload as Record<string, unknown>)
        ? (payload as Record<string, unknown>)["detail"]
        : payload;
    if (response.status === 401) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    throw new ApiError(response.status, humanMessage(response.status, detail), detail);
  }

  return payload as T;
}

export const api = {
  get: <T,>(path: string) => apiRequest<T>(path),
  post: <T,>(path: string, body?: unknown, auth = true) =>
    apiRequest<T>(path, { method: "POST", body, auth }),
  put: <T,>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
  del: <T,>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
  upload: <T,>(path: string, formData: FormData) =>
    apiRequest<T>(path, { method: "POST", formData }),
};

/** Backend scores may be 0–1 or 0–100; normalise to a 0–100 percentage. */
export function toPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const pct = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Backends sometimes stash JSON inside a free-text notes field. */
export function safeParseNotes(notes?: string | null): { text?: string; json?: unknown } {
  if (!notes) return {};
  try {
    const parsed: unknown = JSON.parse(notes);
    if (parsed && typeof parsed === "object") return { json: parsed };
  } catch {
    /* not JSON */
  }
  return { text: notes };
}