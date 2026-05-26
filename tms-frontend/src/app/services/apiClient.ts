import { clearAuthSession, getAccessToken } from "./authStorage";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiRequestOptions = RequestInit & {
  withAuth?: boolean;
};

const apiBaseUrl = "/api";

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { withAuth = true, headers, ...init } = options;

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type") && init.body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (withAuth) {
    const token = getAccessToken();
    if (!token) {
      throw new ApiError("Bạn chưa đăng nhập", 401);
    }

    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: requestHeaders,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  let data: unknown = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    let message = "Request failed";

    if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
      message = data.error;
    } else if (response.status === 401) {
      message = "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn";
      clearAuthSession();
    } else if (responseText.trim().length > 0) {
      message = responseText.trim();
    }

    throw new ApiError(message, response.status);
  }

  return data as T;
}
