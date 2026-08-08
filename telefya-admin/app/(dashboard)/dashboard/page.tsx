"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  FileCheck2,
  Mail,
  Radio,
  ShieldCheck,
  Users,
  Video,
  Wifi,
} from "lucide-react";

import { MetricCard } from "@/components/admin/MetricCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import {
  getAdminDashboard,
  getAdminReportingOverview,
  listCampaigns,
} from "@/lib/api/admin";
import type { AdminCampaign } from "@/types/admin";

function formatNumber(value?: number) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusClass(status?: string) {
  switch (status?.toLowerCase()) {
    case "sent":
      return "bg-emerald-50 text-telefya-green";
    case "scheduled":
      return "bg-violet-50 text-telefya-violet";
    case "failed":
      return "bg-red-50 text-telefya-coral";
    case "sending":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-navy-50 text-navy-500";
  }
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const TONE_CLASSES: Record<"blue" | "green" | "violet" | "coral", string> = {
  blue: "bg-blue-50 text-telefya-blue",
  green: "bg-emerald-50 text-telefya-green",
  violet: "bg-violet-50 text-telefya-violet",
  coral: "bg-red-50 text-telefya-coral",
};

export default function DashboardPage() {
  const range = useMemo(defaultRange, []);

  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
  });

  const reportQuery = useQuery({
    queryKey: ["admin-dashboard-reports", range],
    queryFn: () => getAdminReportingOverview(range),
  });

  const campaignsQuery = useQuery({
    queryKey: ["admin-dashboard-campaigns"],
    queryFn: () => listCampaigns(1, 5),
  });

  const dashboard = dashboardQuery.data?.data;
  const report = reportQuery.data?.data;
  const campaigns = campaignsQuery.data?.data?.campaigns || [];

  const totalUsers = dashboard?.users?.total_users || 0;
  const activeUsers = dashboard?.users?.active_users || 0;
  const totalMeetings = dashboard?.meetings?.total_meetings || 0;
  const liveMeetings = dashboard?.meetings?.live_meetings || 0;
  const recordings = dashboard?.recordings?.total_recordings || 0;
  const campaignsTotal = dashboard?.campaigns?.total_campaigns || 0;

  const reportSections = [
    {
      href: "/reports/usage",
      title: "Usage & adoption",
      description: "Hosts, participants, minutes, and devices.",
      icon: Users,
      value: formatNumber(report?.usage?.overview?.active_users),
      label: "active users",
      tone: "blue" as const,
    },
    {
      href: "/reports/quality",
      title: "Quality & health",
      description: "Latency, jitter, and unstable sessions.",
      icon: Wifi,
      value: report?.quality?.telemetry_available
        ? `${formatNumber(report.quality.overview.average_quality_score)}/100`
        : "—",
      label: report?.quality?.telemetry_available
        ? "quality score"
        : "awaiting telemetry",
      tone: "green" as const,
    },
    {
      href: "/reports/compliance",
      title: "Meetings & compliance",
      description: "Attendance, recordings, and storage.",
      icon: FileCheck2,
      value: formatNumber(report?.compliance?.overview?.attendance_records),
      label: "attendance records",
      tone: "violet" as const,
    },
    {
      href: "/reports/security",
      title: "Security & audit",
      description: "Administrator activity and account actions.",
      icon: ShieldCheck,
      value: formatNumber(report?.security?.overview?.admin_actions),
      label: "admin actions",
      tone: "coral" as const,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Platform overview"
          title="Dashboard"
          description="Monitor Telefya platform activity across users, meetings, and communication."
        />

        <span className="inline-flex h-fit items-center gap-2 rounded-full border border-telefya-green/20 bg-emerald-50/70 px-3.5 py-2 text-xs font-black text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-telefya-green shadow-[0_0_0_4px_rgba(34,211,134,0.14)]" />
          Admin session active
        </span>
      </div>

      {dashboardQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-telefya-coral">
          Unable to load dashboard data. Confirm the backend is running, then
          refresh this page.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Users"
          value={dashboardQuery.isLoading ? "—" : formatNumber(totalUsers)}
          icon={<Users size={21} />}
          detail={`${formatNumber(activeUsers)} active accounts`}
          tone="blue"
        />

        <MetricCard
          label="Meetings"
          value={dashboardQuery.isLoading ? "—" : formatNumber(totalMeetings)}
          icon={<CalendarDays size={21} />}
          detail={`${formatNumber(liveMeetings)} currently live`}
          tone="violet"
        />

        <MetricCard
          label="Recordings"
          value={dashboardQuery.isLoading ? "—" : formatNumber(recordings)}
          icon={<Video size={21} />}
          detail="Platform recordings"
          tone="green"
        />

        <MetricCard
          label="Campaigns"
          value={dashboardQuery.isLoading ? "—" : formatNumber(campaignsTotal)}
          icon={<Mail size={21} />}
          detail="Email campaign drafts"
          tone="coral"
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-navy-900">
              Reports at a glance
            </h2>
            <p className="mt-1 text-sm text-navy-500">
              A 30-day snapshot of adoption, quality, compliance, and
              security.
            </p>
          </div>

          <Link
            href="/reports"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-telefya-blue transition hover:text-telefya-violet"
          >
            Open reports
            <ArrowUpRight size={16} />
          </Link>
        </div>

        {reportQuery.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            Unable to load report summaries. Confirm the reporting backend is
            running.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {reportSections.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.href}
                href={section.href}
                className="group flex flex-col rounded-2xl border border-border bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-enterprise"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-xl ${TONE_CLASSES[section.tone]}`}
                  >
                    <Icon size={19} />
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-navy-300 transition group-hover:translate-x-1 group-hover:text-navy-500"
                  />
                </div>

                <h3 className="mt-4 font-black text-navy-900">
                  {section.title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-navy-500">
                  {section.description}
                </p>

                <p className="mt-4 text-2xl font-black text-navy-900">
                  {reportQuery.isLoading ? "—" : section.value}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy-400">
                  {section.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-border bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
                <Mail size={19} />
              </span>

              <div>
                <h2 className="font-black text-navy-900">
                  Recent campaigns
                </h2>
                <p className="mt-1 text-sm text-navy-500">
                  The last drafts and sends across the platform.
                </p>
              </div>
            </div>

            <Link
              href="/campaigns"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-telefya-blue transition hover:text-telefya-violet"
            >
              View all
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="px-2 py-2 sm:px-4">
            {campaignsQuery.isError ? (
              <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                Unable to load campaigns.
              </div>
            ) : (
              <DataTable<AdminCampaign>
                rows={campaigns}
                getRowKey={(campaign) => String(campaign.id)}
                emptyTitle="No campaigns yet"
                emptyDescription="Create a draft when you are ready to communicate with users."
                columns={[
                  {
                    label: "Campaign",
                    render: (campaign) => (
                      <Link
                        href={`/campaigns/${encodeURIComponent(String(campaign.id))}`}
                        className="group flex min-w-0 items-center gap-3"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-black text-navy-900 group-hover:text-telefya-blue">
                            {campaign.name || "Untitled campaign"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-navy-500">
                            {campaign.subject || "No email subject"}
                          </span>
                        </span>
                      </Link>
                    ),
                  },
                  {
                    label: "Recipients",
                    render: (campaign) =>
                      formatNumber(campaign.total_recipients),
                  },
                  {
                    label: "Status",
                    render: (campaign) => (
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize",
                          statusClass(campaign.status),
                        ].join(" ")}
                      >
                        {campaign.status || "draft"}
                      </span>
                    ),
                  },
                  {
                    label: "Created",
                    className: "text-right",
                    render: (campaign) => formatDate(campaign.created_at),
                  },
                ]}
              />
            )}
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
                <Radio size={19} />
              </span>

              <div>
                <h2 className="font-black text-navy-900">Quick actions</h2>
                <p className="mt-1 text-sm text-navy-500">
                  Manage users, audiences, and communication.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <Link
                href="/users"
                className="flex items-center justify-between rounded-xl border border-border p-4 transition hover:border-telefya-blue/30 hover:bg-blue-50"
              >
                <span className="flex items-center gap-3">
                  <Users size={18} className="text-telefya-blue" />
                  <span>
                    <span className="block text-sm font-black text-navy-900">
                      Users
                    </span>
                    <span className="block text-xs text-navy-500">
                      Accounts and access
                    </span>
                  </span>
                </span>
                <ChevronRight size={16} className="text-navy-300" />
              </Link>

              <Link
                href="/audiences"
                className="flex items-center justify-between rounded-xl border border-border p-4 transition hover:border-telefya-violet/30 hover:bg-violet-50"
              >
                <span className="flex items-center gap-3">
                  <Users size={18} className="text-telefya-violet" />
                  <span>
                    <span className="block text-sm font-black text-navy-900">
                      Audiences
                    </span>
                    <span className="block text-xs text-navy-500">
                      Recipient groups
                    </span>
                  </span>
                </span>
                <ChevronRight size={16} className="text-navy-300" />
              </Link>

              <Link
                href="/campaigns/new"
                className="flex items-center justify-between rounded-xl border border-border p-4 transition hover:border-telefya-green/30 hover:bg-emerald-50"
              >
                <span className="flex items-center gap-3">
                  <Mail size={18} className="text-telefya-green" />
                  <span>
                    <span className="block text-sm font-black text-navy-900">
                      New campaign
                    </span>
                    <span className="block text-xs text-navy-500">
                      Create a draft
                    </span>
                  </span>
                </span>
                <ChevronRight size={16} className="text-navy-300" />
              </Link>
            </div>
          </article>

          <article className="rounded-2xl bg-navy-900 p-6 text-white shadow-enterprise">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
              Administration
            </p>

            <p className="mt-3 text-2xl font-black">
              Platform access active
            </p>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Your account has verified administrator access for this
              environment.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-lg font-black">
                  {reportQuery.isLoading
                    ? "—"
                    : formatNumber(
                        report?.security?.overview?.admin_actions,
                      )}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Admin actions (30d)
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-lg font-black text-telefya-green">
                  {dashboardQuery.isLoading
                    ? "—"
                    : formatNumber(liveMeetings)}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Live meetings now
                </p>
              </div>
            </div>

            <Link
              href="/users"
              className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-black text-navy-900 transition hover:bg-navy-100"
            >
              Manage users
            </Link>
          </article>
        </aside>
      </section>
    </div>
  );
}