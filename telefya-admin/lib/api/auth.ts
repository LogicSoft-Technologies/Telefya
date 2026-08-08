import { ApiError } from "@/lib/api/client";
import type { AdminDashboard } from "@/types/admin";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v2";

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  success?: boolean;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    token?: string;
  };
};

function getToken(response: LoginResponse) {
  return (
    response.accessToken ||
    response.token ||
    response.data?.accessToken ||
    response.data?.token ||
    ""
  );
}

function getRefreshToken(response: LoginResponse) {
  return response.refreshToken || response.data?.refreshToken || "";
}

export async function loginAdmin(payload: LoginPayload) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as LoginResponse;

  if (!response.ok || body.success === false) {
    throw new ApiError(
      body.message || "Unable to sign in.",
      response.status,
      body,
    );
  }

  const accessToken = getToken(body);

  if (!accessToken) {
    throw new ApiError(
      "The server did not return an access token.",
      response.status,
      body,
    );
  }

  const dashboardResponse = await fetch(`${API_BASE_URL}/admin/dashboard`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const dashboardBody = (await dashboardResponse
    .json()
    .catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: AdminDashboard;
  };

  if (!dashboardResponse.ok || dashboardBody.success === false) {
    throw new ApiError(
      dashboardBody.message ||
        "This account does not have Telefya administrator access.",
      dashboardResponse.status,
      dashboardBody,
    );
  }

  return {
    accessToken,
    refreshToken: getRefreshToken(body),
    dashboard: dashboardBody.data,
  };
}