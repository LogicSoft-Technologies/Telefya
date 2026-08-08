"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Video } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAdminRecordings } from "@/lib/api/admin";
import type { AdminRecording } from "@/types/admin";

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds < 1) return "-";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

function formatSize(bytes?: number | null) {
  if (!bytes || bytes < 1) return "-";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export default function RecordingsPage() {
  const [search, setSearch] = useState("");

  const recordingsQuery = useQuery({
    queryKey: ["admin-recordings", search],
    queryFn: () =>
      listAdminRecordings({
        limit: 50,
        search: search.trim() || undefined,
      }),
  });

  const result = recordingsQuery.data?.data;
  const recordings = result?.recordings || [];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform media"
        title="Recordings"
        description="Review recordings created across Telefya."
      />

      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="relative w-full lg:max-w-md">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search recording, room, title, or host"
            className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </section>

      {recordingsQuery.isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-[74px] animate-pulse rounded-2xl border border-border bg-white"
            />
          ))}
        </div>
      ) : null}

      {recordingsQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-telefya-coral">
          Unable to load recordings. Ensure the `/admin/recordings` backend
          endpoint was added and restart the backend.
        </div>
      ) : null}

      {!recordingsQuery.isLoading && !recordingsQuery.isError ? (
        <DataTable<AdminRecording>
          rows={recordings}
          getRowKey={(recording) => String(recording.id)}
          emptyTitle="No recordings found"
          emptyDescription="Recordings created on the platform will appear here."
          columns={[
            {
              label: "Recording",
              render: (recording) => (
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
                    <Video size={18} />
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate font-black text-navy-900">
                      {recording.title ||
                        recording.meeting_description ||
                        recording.room_id ||
                        "Untitled recording"}
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-navy-500">
                      {recording.host_email || recording.recording_id}
                    </span>
                  </span>
                </div>
              ),
            },
            {
              label: "Duration",
              render: (recording) =>
                formatDuration(recording.duration_seconds),
            },
            {
              label: "Size",
              render: (recording) => formatSize(recording.size_bytes),
            },
            {
              label: "Status",
              render: (recording) => (
                <span className="inline-flex rounded-full bg-navy-50 px-2.5 py-1 text-xs font-black capitalize text-navy-600">
                  {recording.status || "unknown"}
                </span>
              ),
            },
            {
              label: "Created",
              render: (recording) => formatDate(recording.created_at),
            },
          ]}
        />
      ) : null}
    </div>
  );
}