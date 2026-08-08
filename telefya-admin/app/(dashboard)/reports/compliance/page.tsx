"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, HardDrive, Users, Video } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/admin/MetricCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportRangePicker } from "@/components/admin/ReportRangerPicker";
import { getAdminComplianceReport } from "@/lib/api/admin";
import type { ComplianceAttendanceRecord } from "@/types/admin";

function initialRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatBytes(bytes?: number) {
  const value = Number(bytes || 0);

  if (!value) return "0 B";
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function ComplianceReportPage() {
  const initial = initialRange();
  const [fromInput, setFromInput] = useState(initial.from);
  const [toInput, setToInput] = useState(initial.to);
  const [range, setRange] = useState(initial);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-compliance-report", range, page],
    queryFn: () =>
      getAdminComplianceReport({
        ...range,
        page,
        limit: 25,
      }),
  });

  const report = query.data?.data;
  const overview = report?.overview;
  const pagination = report?.pagination;

  return (
    <main className="space-y-7">
      <PageHeader
        eyebrow="Reports"
        title="Meetings & compliance"
        description="Attendance records, recording activity, and platform storage use."
      />

      <ReportRangePicker
        from={fromInput}
        to={toInput}
        loading={query.isFetching}
        onFromChange={setFromInput}
        onToChange={setToInput}
        onApply={() => {
          setPage(1);
          setRange({ from: fromInput, to: toInput });
        }}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Attendance records"
          value={Number(overview?.attendance_records || 0)}
          detail={`${Number(overview?.unique_attendees || 0)} unique attendees`}
          icon={<Users size={21} />}
        />
        <MetricCard
          label="Attended minutes"
          value={Number(overview?.attended_minutes || 0)}
          detail="Across all participant sessions"
          tone="green"
          icon={<Clock3 size={21} />}
        />
        <MetricCard
          label="Recordings"
          value={Number(overview?.total_recordings || 0)}
          detail={`${Number(overview?.ready_recordings || 0)} ready to view`}
          tone="violet"
          icon={<Video size={21} />}
        />
        <MetricCard
          label="Storage"
          value={formatBytes(overview?.storage_bytes)}
          detail="Recorded meeting files"
          tone="coral"
          icon={<HardDrive size={21} />}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-navy-900">
            Attendance detail
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Exact participant join and leave activity.
          </p>
        </div>

        <DataTable<ComplianceAttendanceRecord>
          rows={report?.attendance || []}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No attendance records"
          emptyDescription="There are no meeting attendance records for this period."
          columns={[
            {
              label: "Participant",
              render: (row) => (
                <div>
                  <p className="font-black text-navy-900">
                    {row.attendee_name || "Participant"}
                  </p>
                  <p className="text-xs text-navy-500">
                    {row.attendee_email}
                  </p>
                </div>
              ),
            },
            {
              label: "Meeting",
              render: (row) => (
                <p className="max-w-48 truncate font-bold text-navy-700">
                  {row.meeting_title}
                </p>
              ),
            },
            {
              label: "Joined",
              render: (row) =>
                row.joined_at
                  ? new Date(row.joined_at).toLocaleString()
                  : "—",
            },
            {
              label: "Left",
              render: (row) =>
                row.left_at
                  ? new Date(row.left_at).toLocaleString()
                  : "In meeting",
            },
            {
              label: "Minutes",
              render: (row) => Number(row.duration_minutes || 0),
            },
          ]}
        />

        {pagination ? (
          <div className="flex items-center justify-end gap-3">
            <p className="text-sm font-bold text-navy-500">
              Page {pagination.page}
            </p>
            <button
              type="button"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-black text-navy-700 transition hover:bg-navy-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={
                page * pagination.limit >= pagination.total ||
                query.isFetching
              }
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg bg-telefya-blue px-3 py-2 text-sm font-black text-white transition hover:bg-telefya-violet disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}