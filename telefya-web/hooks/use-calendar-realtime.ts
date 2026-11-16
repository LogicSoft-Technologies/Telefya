"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { getAccessToken } from "@/lib/auth/tokens";

type CalendarChangePayload = {
  meetingId: number;
  eventType: string;
  occurredAt: string;
};

function getSocketOrigin() {
  const configured =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://api.telefya.com";

  try {
    return new URL(configured).origin;
  } catch {
    return "https://api.telefya.com";
  }
}

export function useCalendarRealtime(
  onCalendarChanged: (event: CalendarChangePayload) => void,
) {
  const callbackRef = useRef(onCalendarChanged);

  useEffect(() => {
    callbackRef.current = onCalendarChanged;
  }, [onCalendarChanged]);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    const socket: Socket = io(`${getSocketOrigin()}/calendar`, {
      transports: ["websocket", "polling"],
      auth: {
        token,
        accessToken: token,
      },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.4,
      timeout: 12_000,
    });

    function handleCalendarChanged(payload: CalendarChangePayload) {
      if (!payload || !Number.isInteger(Number(payload.meetingId))) {
        return;
      }

      callbackRef.current(payload);
    }

    socket.on("calendar:changed", handleCalendarChanged);

    return () => {
      socket.off("calendar:changed", handleCalendarChanged);
      socket.disconnect();
    };
  }, []);
}