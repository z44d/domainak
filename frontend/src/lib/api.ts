export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type Primitive = string | number | boolean;

type RequestOptions = {
  signal?: AbortSignal;
  params?: Record<string, Primitive | null | undefined>;
};

type MutationOptions = RequestOptions & {
  headers?: HeadersInit;
};

type JsonBody = Record<string, unknown> | Array<unknown>;


function getRequestBaseUrl() {
  const url = new URL("/api", window.location.origin).toString();
  // Ensure it ends with a slash so new URL(path, base) appends correctly
  return url.endsWith("/") ? url : `${url}/`;
}

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const baseUrl = getRequestBaseUrl();
  
  // Remove the leading slash from the path if it exists
  const relativePath = path.startsWith('/') ? path.slice(1) : path;

  // Now the URL constructor will append it to the end of the base path
  const url = new URL(relativePath, baseUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

async function request<T>(
  path: string,
  init: RequestInit,
  options?: MutationOptions,
) {
  const token = localStorage.getItem("session_token");
  const headers = new Headers(options?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, options?.params), {
    ...init,
    headers,
    credentials: "include",
    signal: options?.signal,
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, data);
  }

  return { data: data as T };
}

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { method: "GET" }, options);
  },
  post<T>(path: string, body?: JsonBody, options?: MutationOptions) {
    const headers = new Headers(options?.headers);
    headers.set("Content-Type", "application/json");

    return request<T>(
      path,
      {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      },
      {
        ...options,
        headers,
      },
    );
  },
  delete<T>(path: string, options?: MutationOptions) {
    return request<T>(path, { method: "DELETE" }, options);
  },
};
