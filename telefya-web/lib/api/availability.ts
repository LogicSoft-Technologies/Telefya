import { apiRequest } from "@/lib/api/client";

export type BookingProfile = {
  id: number;
  userId: string;
  bookingSlug: string;
  displayName: string;
  welcomeMessage: string;
  defaultDurationMinutes: number;
  minimumNoticeMinutes: number;
  bookingWindowDays: number;
  timeZone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityRule = {
  id: number;
  weekday: number;
  startTime: string;
  endTime: string;
};

export type AvailabilityException = {
  id: number;
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilitySettings = {
  profile: BookingProfile | null;
  rules: AvailabilityRule[];
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export async function getAvailabilitySettings() {
  return apiRequest<ApiResponse<AvailabilitySettings>>(
    "/user/calendar/availability",
    { method: "GET" },
  );
}

export async function saveBookingProfile(payload: {
  bookingSlug: string;
  displayName: string;
  welcomeMessage?: string;
  defaultDurationMinutes: number;
  minimumNoticeMinutes: number;
  bookingWindowDays: number;
  timeZone: string;
  isActive: boolean;
}) {
  return apiRequest<ApiResponse<AvailabilitySettings>>(
    "/user/calendar/booking-profile",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function saveAvailabilityRules(
  rules: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
  }>,
) {
  return apiRequest<ApiResponse<AvailabilitySettings>>(
    "/user/calendar/availability/rules",
    {
      method: "PUT",
      body: JSON.stringify({ rules }),
    },
  );
}

export async function getAvailabilityExceptions(params?: {
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();

  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return apiRequest<ApiResponse<AvailabilityException[]>>(
    `/user/calendar/availability/exceptions${suffix}`,
    { method: "GET" },
  );
}

export async function createAvailabilityException(payload: {
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  note?: string;
}) {
  return apiRequest<ApiResponse<AvailabilityException>>(
    "/user/calendar/availability/exceptions",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteAvailabilityException(exceptionId: number) {
  return apiRequest<ApiResponse<null>>(
    `/user/calendar/availability/exceptions/${exceptionId}`,
    { method: "DELETE" },
  );
}

export type PublicBookingProfile = {
  bookingSlug: string;
  displayName: string;
  welcomeMessage: string;
  durationMinutes: number;
  timeZone: string;
};

export type BookingSlot = {
  startsAt: string;
  endsAt: string;
};

export async function getPublicBookingProfile(slug: string) {
  return apiRequest<ApiResponse<PublicBookingProfile>>(
    `/public/book/${encodeURIComponent(slug)}`,
    { method: "GET" },
  );
}

export async function getPublicBookingSlots(
  slug: string,
  params: {
    from: string;
    to: string;
  },
) {
  const query = new URLSearchParams(params);

  return apiRequest<
    ApiResponse<{
      profile: PublicBookingProfile;
      from: string;
      to: string;
      slots: BookingSlot[];
    }>
  >(
    `/public/book/${encodeURIComponent(slug)}/slots?${query.toString()}`,
    { method: "GET" },
  );
}

export async function createPublicBooking(
  slug: string,
  payload: {
    guestName: string;
    guestEmail: string;
    guestTimeZone: string;
    meetingTitle?: string;
    startsAt: string;
  },
) {
  return apiRequest<
    ApiResponse<{
      bookingId: number;
      bookingSlug: string;
      hostName: string;
      meetingTitle: string;
      startsAt: string;
      endsAt: string;
      timeZone: string;
    }>
  >(`/public/book/${encodeURIComponent(slug)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}