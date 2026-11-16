"use client";

import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  disconnectGoogleCalendar,
  getCalendarConnections,
  startGoogleCalendarConnection,
  type CalendarConnection,
} from "@/lib/api/calendar-connections";

export function CalendarConnectionsPanel() {
  const [googleConnection, setGoogleConnection] =
    useState<CalendarConnection | null>(null);

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadConnections() {
    setLoading(true);
    setError("");

    try {
      const response = await getCalendarConnections();

      setGoogleConnection(
        response.data.find(
          (connection) => connection.provider === "google",
        ) || null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load calendar connections.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("calendarSync");
    const message = params.get("calendarSyncMessage");

    if (status === "google_connected") {
      setNotice(
        "Google Calendar connected. Your upcoming Telefya meetings are syncing.",
      );
    } else if (status === "google_denied") {
      setError(
        message ||
          "Google Calendar permission was not granted.",
      );
    } else if (status === "google_error") {
      setError(
        message ||
          "Google Calendar could not be connected.",
      );
    }

    if (status) {
      params.delete("calendarSync");
      params.delete("calendarSyncMessage");

      const nextQuery = params.toString();

      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${
          nextQuery ? `?${nextQuery}` : ""
        }`,
      );
    }

    void loadConnections();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError("");
    setNotice("");

    try {
      const response = await startGoogleCalendarConnection();

      window.location.assign(response.data.authorizationUrl);
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Unable to connect Google Calendar.",
      );

      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const shouldDisconnect = window.confirm(
      "Disconnect Google Calendar? Existing Google events will remain, but Telefya will no longer create or update them.",
    );

    if (!shouldDisconnect) return;

    setDisconnecting(true);
    setError("");
    setNotice("");

    try {
      const response = await disconnectGoogleCalendar();

      setGoogleConnection(null);
      setNotice(response.message || "Google Calendar disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Unable to disconnect Google Calendar.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  const isConnected = googleConnection?.status === "active";

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
      <div className="telefya-accent-line h-1" />

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white shadow-soft ring-1 ring-border">
            <span className="text-xl font-black text-[#4285F4]">G</span>
          </span>

          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-telefya-blue">
              <Link2 size={13} />
              Calendar integration
            </span>

            <h2 className="mt-3 text-lg font-black text-navy-900">
              Google Calendar
            </h2>

            <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-navy-500">
              Sync your Telefya meetings one way to your Google Calendar.
              Telefya remains the source of truth for meeting changes.
            </p>

            {isConnected ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-emerald-600">
                <CheckCircle2 size={14} />
                Connected
                {googleConnection?.accountEmail
                  ? ` as ${googleConnection.accountEmail}`
                  : ""}
              </p>
            ) : googleConnection?.status === "error" ? (
              <p className="mt-2 text-xs font-bold text-red-600">
                Reconnect Google Calendar to resume syncing.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {loading ? (
            <div className="flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold text-navy-400">
              <Loader2 size={16} className="animate-spin" />
              Checking…
            </div>
          ) : isConnected ? (
            <>
              <button
                type="button"
                onClick={() => void loadConnections()}
                aria-label="Refresh Google Calendar connection"
                className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-telefya-blue hover:text-telefya-blue"
              >
                <RefreshCw size={16} />
              </button>

              <button
                type="button"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {disconnecting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Unplug size={16} />
                )}
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-telefya-blue px-4 text-sm font-black text-white shadow-soft transition hover:bg-telefya-violet disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ExternalLink size={16} />
              )}
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 sm:px-6"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 sm:px-6"
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}