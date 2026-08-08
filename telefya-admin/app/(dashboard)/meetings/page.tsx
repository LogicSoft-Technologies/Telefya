"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
} from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/admin/MetricCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAdminMeetings } from "@/lib/api/admin";
import type { AdminMeeting } from "@/types/admin";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getHostName(meeting: AdminMeeting) {
  return (
    [meeting.host_first_name, meeting.host_last_name]
      .filter(Boolean)
      .join(" ") ||
    meeting.host_email ||
    "Unknown host"
  );
}

function statusClass(status: AdminMeeting["status"]) {
  switch (status) {
    case "live":
      return "bg-emerald-50 text-emerald-700";
    case "upcoming":
      return "bg-blue-50 text-telefya-blue";
    case "ended":
      return "bg-navy-100 text-navy-600";
    default:
      return "bg-red-50 text-telefya-coral";
  }
}

export default function MeetingsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    AdminMeeting["status"] | ""
  >("");
  const [page, setPage] = useState(1);

  const meetingsQuery = useQuery({
    queryKey: ["admin-meetings", page, search, status],
    queryFn: () =>
      listAdminMeetings({
        page,
        limit: 25,
        search,
        status: status || undefined,
      }),
  });

  const data = meetingsQuery.data?.data;
  const meetings = data?.meetings || [];
  const pagination = data?.pagination;

  const totalMeetings = pagination?.total || 0;
  const liveMeetings = meetings.filter(
    (meeting) => meeting.status === "live",
  ).length;
  const upcomingMeetings = meetings.filter(
    (meeting) => meeting.status === "upcoming",
  ).length;
  const participants = meetings.reduce(
    (total, meeting) =>
      total + Number(meeting.accepted_members || 0),
    0,
  );

  function applyFilters() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <main className="space-y-7">
      <PageHeader
        eyebrow="Platform operations"
        title="Meetings"
        description="Monitor scheduled, active, and completed meetings across Telefya."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Meetings"
          value={meetingsQuery.isLoading ? "—" : totalMeetings}
          detail="Matching the current filters"
          icon={<CalendarDays size={21} />}
        />
        <MetricCard
          label="Live now"
          value={meetingsQuery.isLoading ? "—" : liveMeetings}
          detail="On this results page"
          tone="green"
          icon={<Users size={21} />}
        />
        <MetricCard
          label="Upcoming"
          value={meetingsQuery.isLoading ? "—" : upcomingMeetings}
          detail="On this results page"
          tone="violet"
          icon={<CalendarDays size={21} />}
        />
        <MetricCard
          label="Accepted guests"
          value={meetingsQuery.isLoading ? "—" : participants}
          detail="Across displayed meetings"
          tone="coral"
          icon={<Users size={21} />}
        />
      </section>

      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Search host, email, meeting link, or title"
              className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-3 text-sm font-medium text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(
                event.target.value as AdminMeeting["status"] | "",
              );
            }}
            className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-700 outline-none focus:border-telefya-blue"
          >
            <option value="">All statuses</option>
            <option value="live">Live</option>
            <option value="upcoming">Upcoming</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={applyFilters}
            className="h-11 rounded-xl bg-telefya-blue px-5 text-sm font-black text-white transition hover:bg-telefya-violet"
          >
            Search
          </button>
        </div>
      </section>

      {meetingsQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          Unable to load platform meetings. Confirm the admin backend is
          running.
        </div>
      ) : null}

      <DataTable<AdminMeeting>
        rows={meetings}
        getRowKey={(row) => String(row.id)}
        emptyTitle={
          meetingsQuery.isLoading ? "Loading meetings..." : "No meetings found"
        }
        emptyDescription="Try changing the current filters."
        columns={[
          {
            label: "Meeting",
            render: (row) => (
              <div className="max-w-64">
                <p className="truncate font-black text-navy-900">
                  {row.des || "Untitled meeting"}
                </p>
                <p className="mt-1 truncate text-xs text-navy-500">
                  {row.meeting_url}
                </p>
              </div>
            ),
          },
          {
            label: "Host",
            render: (row) => (
              <div>
                <p className="font-bold text-navy-800">
                  {getHostName(row)}
                </p>
                <p className="text-xs text-navy-500">
                  {row.host_email}
                </p>
              </div>
            ),
          },
          {
            label: "Schedule",
            render: (row) => formatDate(row.scheduled_for),
          },
          {
            label: "Guests",
            render: (row) => Number(row.accepted_members || 0),
          },
          {
            label: "Status",
            render: (row) => (
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize",
                  statusClass(row.status),
                ].join(" ")}
              >
                {row.status}
              </span>
            ),
          },
        ]}
      />

      {pagination ? (
        <section className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-navy-500">
            Showing page {pagination.page} of{" "}
            {Math.max(1, Math.ceil(pagination.total / pagination.limit))}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || meetingsQuery.isFetching}
              onClick={() => setPage((current) => current - 1)}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm font-black text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              disabled={
                page * pagination.limit >= pagination.total ||
                meetingsQuery.isFetching
              }
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-telefya-blue px-3 text-sm font-black text-white transition hover:bg-telefya-violet disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}