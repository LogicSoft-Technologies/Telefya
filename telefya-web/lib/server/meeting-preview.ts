type PublicMeetingPreview = {
  roomId: string;
  title: string;
  scheduledFor: string;
  durationMinutes: number;
  timeZone: string;
  status: "upcoming" | "live" | "ended" | "cancelled";
};

type PreviewResponse = {
  success: boolean;
  data?: PublicMeetingPreview;
};

function getApiBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/+$/, "");
}

export async function getPublicMeetingPreview(roomId: string) {
  if (!/^[a-zA-Z0-9_-]{3,120}$/.test(roomId)) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    return null;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/public/meetings/${encodeURIComponent(roomId)}/preview`,
      {
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as PreviewResponse;

    return payload.success && payload.data ? payload.data : null;
  } catch {
    return null;
  }
}

export function formatMeetingTime(
  value: string,
  timeZone: string,
) {
  try {
    return new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}