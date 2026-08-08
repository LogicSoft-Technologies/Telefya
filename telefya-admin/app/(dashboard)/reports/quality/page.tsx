"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Gauge, Wifi } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/admin/MetricCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportRangePicker } from "@/components/admin/ReportRangerPicker";
import { getAdminQualityReport } from "@/lib/api/admin";
import type { QualityAffectedUser } from "@/types/admin";

function initialRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function value(number?: number, suffix = "") {
  return `${Number(number || 0).toFixed(1)}${suffix}`;
}

export default function QualityReportPage() {
  const initial = initialRange();
  const [fromInput, setFromInput] = useState(initial.from);
  const [toInput, setToInput] = useState(initial.to);
  const [range, setRange] = useState(initial);

  const query = useQuery({
    queryKey: ["admin-quality-report", range],
    queryFn: () => getAdminQualityReport(range),
  });

  const report = query.data?.data;
  const overview = report?.overview;

  return (
    <main className="space-y-7">
      <PageHeader
        eyebrow="Reports"
        title="Quality & health"
        description="Network performance and unstable-session signals from active meeting clients."
      />

      <ReportRangePicker
        from={fromInput}
        to={toInput}
        loading={query.isFetching}
        onFromChange={setFromInput}
        onToChange={setToInput}
        onApply={() => setRange({ from: fromInput, to: toInput })}
      />

      {!query.isLoading && !report?.telemetry_available ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-navy-700">
          <p className="font-black text-navy-900">No quality samples yet</p>
          <p className="mt-1">
            Quality data begins after a user joins a meeting with the updated
            Mediasoup telemetry hook running.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Quality score"
          value={query.isLoading ? "—" : `${value(overview?.average_quality_score)}/100`}
          detail="Average measured connection quality"
          icon={<Gauge size={21} />}
        />
        <MetricCard
          label="Round-trip time"
          value={query.isLoading ? "—" : value(overview?.average_round_trip_time_ms, " ms")}
          detail="Average network latency"
          tone="green"
          icon={<Wifi size={21} />}
        />
        <MetricCard
          label="Packet loss"
          value={query.isLoading ? "—" : value(overview?.average_packet_loss_percent, "%")}
          detail="Average measured packet loss"
          tone="violet"
          icon={<Activity size={21} />}
        />
        <MetricCard
          label="Unstable samples"
          value={query.isLoading ? "—" : Number(overview?.unstable_samples || 0)}
          detail={`${Number(overview?.affected_users || 0)} affected users`}
          tone="coral"
          icon={<AlertTriangle size={21} />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
          <h2 className="font-black text-navy-900">Connection states</h2>
          <div className="mt-5 space-y-3">
            {(report?.connection_states || []).map((state) => (
              <div
                key={state.connection_state}
                className="flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3"
              >
                <span className="font-bold capitalize text-navy-700">
                  {state.connection_state.replaceAll("_", " ")}
                </span>
                <span className="font-black text-navy-900">
                  {state.total}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
          <h2 className="font-black text-navy-900">Daily quality</h2>
          <div className="mt-5 max-h-[280px] space-y-3 overflow-y-auto pr-1">
            {(report?.daily_quality || []).map((day) => (
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
                  {value(day.average_quality_score)}/100
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-navy-900">
            Affected participants
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Users with one or more unstable network samples.
          </p>
        </div>

        <DataTable<QualityAffectedUser>
          rows={report?.affected_users || []}
            getRowKey={(row) => row.user_id || row.email || "unknown-participant"}
          emptyTitle="No affected participants"
          emptyDescription="No unstable quality samples were recorded for this period."
          columns={[
            {
              label: "Participant",
              render: (row) => (
                <div>
                  <p className="font-black text-navy-900">
                    {row.user_name || "Unknown participant"}
                  </p>
                  <p className="text-xs text-navy-500">{row.email}</p>
                </div>
              ),
            },
            {
              label: "Score",
              render: (row) => `${value(row.average_quality_score)}/100`,
            },
            {
              label: "Latency",
              render: (row) => value(row.average_round_trip_time_ms, " ms"),
            },
            {
              label: "Loss",
              render: (row) => value(row.average_packet_loss_percent, "%"),
            },
            {
              label: "Warnings",
              render: (row) => row.unstable_samples,
            },
          ]}
        />
      </section>
    </main>
  );
}