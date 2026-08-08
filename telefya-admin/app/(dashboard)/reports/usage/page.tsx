"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, MonitorSmartphone, Users, Video } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/admin/MetricCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportRangePicker } from "@/components/admin/ReportRangerPicker";
import { getAdminUsageReport } from "@/lib/api/admin";
import type { UsageDeviceModality, UsageTopHost } from "@/types/admin";

function initialRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const formatNumber = (value?: number) =>
  new Intl.NumberFormat().format(Number(value || 0));

export default function UsageReportPage() {
  const initial = initialRange();
  const [fromInput, setFromInput] = useState(initial.from);
  const [toInput, setToInput] = useState(initial.to);
  const [range, setRange] = useState(initial);

  const query = useQuery({
    queryKey: ["admin-usage-report", range],
    queryFn: () => getAdminUsageReport(range),
  });

  const report = query.data?.data;
  const overview = report?.overview;

  return (
    <main className="space-y-7">
      <PageHeader
        eyebrow="Reports"
        title="Usage & adoption"
        description="Understand who is using Telefya, how often they meet, and how they join."
      />

      <ReportRangePicker
        from={fromInput}
        to={toInput}
        loading={query.isFetching}
        onFromChange={setFromInput}
        onToChange={setToInput}
        onApply={() => setRange({ from: fromInput, to: toInput })}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active users"
          value={query.isLoading ? "—" : formatNumber(overview?.active_users)}
          detail="Unique meeting participants"
          icon={<Users size={21} />}
        />
        <MetricCard
          label="Active hosts"
          value={query.isLoading ? "—" : formatNumber(overview?.active_hosts)}
          detail="Users who started meetings"
          tone="green"
          icon={<Video size={21} />}
        />
        <MetricCard
          label="Meeting minutes"
          value={
            query.isLoading
              ? "—"
              : formatNumber(overview?.total_meeting_minutes)
          }
          detail="Total attended minutes"
          tone="violet"
          icon={<Clock3 size={21} />}
        />
        <MetricCard
          label="Participant sessions"
          value={
            query.isLoading
              ? "—"
              : formatNumber(overview?.total_participant_sessions)
          }
          detail="Individual join sessions"
          tone="coral"
          icon={<MonitorSmartphone size={21} />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-5">
        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft xl:col-span-2">
          <h2 className="font-black text-navy-900">Device modalities</h2>
          <p className="mt-1 text-sm text-navy-500">
            Reported from active meeting clients.
          </p>

          <div className="mt-6 space-y-4">
            {(report?.device_modalities || []).map(
              (device: UsageDeviceModality) => (
                <div
                  key={device.device_type}
                  className="flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold capitalize text-navy-900">
                      {device.device_type}
                    </p>
                    <p className="text-xs text-navy-500">
                      {formatNumber(device.unique_users)} users
                    </p>
                  </div>
                  <p className="text-sm font-black text-telefya-blue">
                    {formatNumber(device.session_events)} joins
                  </p>
                </div>
              ),
            )}

            {!query.isLoading && !report?.device_modalities.length ? (
              <p className="py-6 text-sm text-navy-500">
                Device data will appear after users join with telemetry enabled.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft xl:col-span-3">
          <h2 className="font-black text-navy-900">Daily activity</h2>
          <p className="mt-1 text-sm text-navy-500">
            Meetings and participation across the selected period.
          </p>

          <div className="mt-6 max-h-[280px] space-y-3 overflow-y-auto pr-1">
            {(report?.daily_usage || []).map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3"
              >
                <span className="text-sm font-bold text-navy-700">
                  {new Date(day.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-sm font-black text-navy-900">
                  {formatNumber(day.active_users)} users ·{" "}
                  {formatNumber(day.meetings)} meetings
                </span>
              </div>
            ))}

            {!query.isLoading && !report?.daily_usage.length ? (
              <p className="py-6 text-sm text-navy-500">
                No attendance records exist for this period.
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-navy-900">Top hosts</h2>
          <p className="mt-1 text-sm text-navy-500">
            Ranked by cumulative attended minutes.
          </p>
        </div>

        <DataTable<UsageTopHost>
          rows={report?.top_hosts || []}
          getRowKey={(row) => row.user_id}
          emptyTitle="No host activity"
          emptyDescription="Host activity will appear after meetings are completed."
          columns={[
            {
              label: "Host",
              render: (row) => (
                <div>
                  <p className="font-black text-navy-900">
                    {row.host_name || "Unknown host"}
                  </p>
                  <p className="text-xs text-navy-500">{row.host_email}</p>
                </div>
              ),
            },
            {
              label: "Meetings",
              render: (row) => formatNumber(row.meetings_hosted),
            },
            {
              label: "Participants",
              render: (row) => formatNumber(row.participants),
            },
            {
              label: "Minutes",
              render: (row) => formatNumber(row.meeting_minutes),
            },
          ]}
        />
      </section>
    </main>
  );
}