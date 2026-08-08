"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/admin/MetricCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportRangePicker } from "@/components/admin/ReportRangerPicker";
import { getAdminSecurityReport } from "@/lib/api/admin";
import type { AdminAuditLog } from "@/types/admin";

function initialRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function SecurityReportPage() {
  const initial = initialRange();
  const [fromInput, setFromInput] = useState(initial.from);
  const [toInput, setToInput] = useState(initial.to);
  const [range, setRange] = useState(initial);

  const query = useQuery({
    queryKey: ["admin-security-report", range],
    queryFn: () => getAdminSecurityReport({ ...range, limit: 100 }),
  });

  const report = query.data?.data;
  const overview = report?.overview;

  return (
    <main className="space-y-7">
      <PageHeader
        eyebrow="Reports"
        title="Security & audit"
        description="Administrative actions, account controls, and security-sensitive platform activity."
      />

      <ReportRangePicker
        from={fromInput}
        to={toInput}
        loading={query.isFetching}
        onFromChange={setFromInput}
        onToChange={setToInput}
        onApply={() => setRange({ from: fromInput, to: toInput })}
      />

      {query.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          This report requires an Admin or Super Admin account.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Admin actions"
          value={Number(overview?.admin_actions || 0)}
          detail="Actions in the selected period"
          icon={<Activity size={21} />}
        />
        <MetricCard
          label="Administrators"
          value={Number(overview?.active_administrators || 0)}
          detail="Active platform administrators"
          tone="green"
          icon={<UserCog size={21} />}
        />
        <MetricCard
          label="Account changes"
          value={Number(overview?.account_status_changes || 0)}
          detail="Suspensions and activations"
          tone="violet"
          icon={<ShieldCheck size={21} />}
        />
        <MetricCard
          label="Suspended accounts"
          value={Number(overview?.suspended_accounts || 0)}
          detail="Currently restricted user accounts"
          tone="coral"
          icon={<ShieldAlert size={21} />}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-navy-900">
            Administrator audit trail
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            The latest 100 privileged actions in the selected period.
          </p>
        </div>

        <DataTable<AdminAuditLog>
          rows={report?.audit_log || []}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No administrator actions"
          emptyDescription="No privileged actions were recorded in this period."
          columns={[
            {
              label: "Administrator",
              render: (row) => (
                <div>
                  <p className="font-black text-navy-900">
                    {row.admin_name || "Administrator"}
                  </p>
                  <p className="text-xs text-navy-500">
                    {row.admin_email}
                  </p>
                </div>
              ),
            },
            {
              label: "Action",
              render: (row) => (
                <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-black text-navy-700">
                  {row.action.replaceAll("_", " ")}
                </span>
              ),
            },
            {
              label: "Target",
              render: (row) =>
                row.target_type
                  ? `${row.target_type}${row.target_id ? ` · ${row.target_id}` : ""}`
                  : "—",
            },
            {
              label: "IP address",
              render: (row) => row.ip_address || "—",
            },
            {
              label: "Time",
              render: (row) =>
                row.created_at
                  ? new Date(row.created_at).toLocaleString()
                  : "—",
            },
          ]}
        />
      </section>
    </main>
  );
}