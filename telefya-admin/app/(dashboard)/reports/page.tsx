"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronRight,
  Clock3,
  FileCheck2,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";

import { MetricCard } from "@/components/admin/MetricCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportRangePicker } from "@/components/admin/ReportRangerPicker";
import { getAdminReportingOverview } from "@/lib/api/admin";

function getInitialRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function number(value?: number) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

export default function ReportsPage() {
  const initialRange = getInitialRange();
  const [fromInput, setFromInput] = useState(initialRange.from);
  const [toInput, setToInput] = useState(initialRange.to);
  const [range, setRange] = useState(initialRange);

  const reportQuery = useQuery({
    queryKey: ["admin-reports", range],
    queryFn: () => getAdminReportingOverview(range),
  });

  const report = reportQuery.data?.data;

  const sections = [
    {
      href: "/reports/usage",
      title: "Usage & adoption",
      description: "Hosts, participants, minutes, and device usage.",
      icon: Users,
      value: number(report?.usage?.overview?.active_users),
      label: "active users",
      tone: "blue",
    },
    {
      href: "/reports/quality",
      title: "Quality & health",
      description: "Latency, jitter, packet loss, and unstable sessions.",
      icon: Wifi,
      value: report?.quality?.telemetry_available
        ? `${number(report.quality.overview.average_quality_score)}/100`
        : "—",
      label: report?.quality?.telemetry_available
        ? "quality score"
        : "awaiting telemetry",
      tone: "green",
    },
    {
      href: "/reports/compliance",
      title: "Meetings & compliance",
      description: "Attendance history, recording activity, and storage.",
      icon: FileCheck2,
      value: number(report?.compliance?.overview?.attendance_records),
      label: "attendance records",
      tone: "violet",
    },
    {
      href: "/reports/security",
      title: "Security & audit",
      description: "Administrator activity and account actions.",
      icon: ShieldCheck,
      value: number(report?.security?.overview?.admin_actions),
      label: "admin actions",
      tone: "coral",
    },
  ];

  return (
    <main className="space-y-7">
      <PageHeader
        eyebrow="Platform intelligence"
        title="Reports"
        description="Operational reporting for adoption, quality, compliance, and security."
      />

      <ReportRangePicker
        from={fromInput}
        to={toInput}
        loading={reportQuery.isFetching}
        onFromChange={setFromInput}
        onToChange={setToInput}
        onApply={() => setRange({ from: fromInput, to: toInput })}
      />

      {reportQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          Unable to load reports. Confirm the reporting backend is running.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active users"
          value={
            reportQuery.isLoading
              ? "—"
              : number(report?.usage?.overview?.active_users)
          }
          detail="Joined meetings in the selected period"
          icon={<Users size={21} />}
        />
        <MetricCard
          label="Meeting minutes"
          value={
            reportQuery.isLoading
              ? "—"
              : number(report?.usage?.overview?.total_meeting_minutes)
          }
          detail="Total attended minutes"
          tone="green"
          icon={<Clock3 size={21} />}
        />
        <MetricCard
          label="Live quality"
          value={
            report?.quality?.telemetry_available
              ? `${number(report.quality.overview.average_quality_score)}/100`
              : "—"
          }
          detail={
            report?.quality?.telemetry_available
              ? "Average connection quality"
              : "Available after active meeting telemetry arrives"
          }
          tone="violet"
          icon={<Activity size={21} />}
        />
        <MetricCard
          label="Recordings"
          value={
            reportQuery.isLoading
              ? "—"
              : number(report?.compliance?.overview?.total_recordings)
          }
          detail="Created during the selected period"
          tone="coral"
          icon={<FileCheck2 size={21} />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-2xl border border-border bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-enterprise"
            >
              <div className="flex items-start gap-4">
                <span
                  className={[
                    "grid h-12 w-12 place-items-center rounded-xl",
                    section.tone === "green"
                      ? "bg-emerald-50 text-telefya-green"
                      : section.tone === "violet"
                        ? "bg-violet-50 text-telefya-violet"
                        : section.tone === "coral"
                          ? "bg-red-50 text-telefya-coral"
                          : "bg-blue-50 text-telefya-blue",
                  ].join(" ")}
                >
                  <Icon size={22} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-black text-navy-900">
                      {section.title}
                    </h2>
                    <ChevronRight
                      size={18}
                      className="text-navy-400 transition group-hover:translate-x-1"
                    />
                  </div>
                  <p className="mt-1 text-sm leading-6 text-navy-500">
                    {section.description}
                  </p>
                  <p className="mt-5 text-2xl font-black text-navy-900">
                    {section.value}
                    <span className="ml-2 text-xs font-bold text-navy-400">
                      {section.label}
                    </span>
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}