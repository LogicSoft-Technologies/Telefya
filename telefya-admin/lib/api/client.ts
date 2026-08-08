import {
  clearAdminSession,
  getAdminAccessToken,
} from "@/lib/auth/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000/api/v2";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(
    message: string,
    status = 500,
    payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type ApiRequestOptions = RequestInit & {
  auth?: boolean;
};

function getPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const response = payload as {
    message?: string;
    error?: string | boolean;
  };

  if (
    typeof response.message === "string" &&
    response.message.trim()
  ) {
    return response.message;
  }

  if (
    typeof response.error === "string" &&
    response.error.trim()
  ) {
    return response.error;
  }

  return "";
}

function buildUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    auth = true,
    headers: optionHeaders,
    ...requestOptions
  } = options;

  const headers = new Headers(optionHeaders);

  if (
    requestOptions.body &&
    !(requestOptions.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (auth && !headers.has("Authorization")) {
    const token = getAdminAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(buildUrl(path), {
    ...requestOptions,
    headers,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearAdminSession();
    }

    throw new ApiError(
      getPayloadMessage(payload) || "Request failed.",
      response.status,
      payload,
    );
  }

  return payload as T;
}

export const apiClient = {
  get<T>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: "GET",
    });
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ) {
    return apiRequest<T>(path, {
      ...options,
      method: "POST",
      body:
        body instanceof FormData
          ? body
          : JSON.stringify(body ?? {}),
    });
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ) {
    return apiRequest<T>(path, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    });
  },
};