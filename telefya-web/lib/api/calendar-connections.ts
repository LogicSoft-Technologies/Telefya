import { apiRequest } from "@/lib/api/client";

export type CalendarConnection = {
  id: number;
  provider: "google" | "outlook";
  accountEmail: string | null;
  calendarId: string;
  status: "active" | "error" | "disconnected";
  lastError: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export async function getCalendarConnections() {
  return apiRequest<ApiResponse<CalendarConnection[]>>(
    "/user/calendar/connections",
    { method: "GET" },
  );
}

export async function startGoogleCalendarConnection() {
  return apiRequest<
    ApiResponse<{
      authorizationUrl: string;
    }>
  >("/user/calendar/connections/google/start", {
    method: "POST",
  });
}

export async function disconnectGoogleCalendar() {
  return apiRequest<{
    success: boolean;
    message: string;
  }>("/user/calendar/connections/google", {
    method: "DELETE",
  });
}