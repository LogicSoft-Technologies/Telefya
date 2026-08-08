"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Plus,
  Send,
} from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { listCampaigns } from "@/lib/api/admin";
import type { AdminCampaign } from "@/types/admin";

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

export default function CampaignsPage() {
  const [page, setPage] = useState(1);

  const campaignsQuery = useQuery({
    queryKey: ["admin-campaigns", page],
    queryFn: () => listCampaigns(page, 25),
  });

  const result = campaignsQuery.data?.data;
  const campaigns = result?.campaigns || [];
  const pagination = result?.pagination;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
    : 1;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Communications"
        title="Campaigns"
        description="Create and review platform email communications."
        actions={
          <Link
            href="/campaigns/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-telefya-blue px-4 text-sm font-black text-white transition hover:bg-telefya-violet"
          >
            <Plus size={17} />
            New campaign
          </Link>
        }
      />

      {campaignsQuery.isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-[74px] animate-pulse rounded-2xl border border-border bg-white"
            />
          ))}
        </div>
      ) : null}

      {campaignsQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-telefya-coral">
          Unable to load campaigns. Refresh the page and try again.
        </div>
      ) : null}

      {!campaignsQuery.isLoading && !campaignsQuery.isError ? (
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
                  className="group flex items-center gap-3"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
                    <Mail size={18} />
                  </span>

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
                new Intl.NumberFormat().format(
                  campaign.total_recipients || 0,
                ),
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
              render: (campaign) => formatDate(campaign.created_at),
            },
            {
              label: "",
              className: "text-right",
              render: (campaign) => (
                <Link
                  href={`/campaigns/${encodeURIComponent(String(campaign.id))}`}
                  className="inline-flex items-center gap-2 text-xs font-black text-telefya-blue transition hover:text-telefya-violet"
                >
                  View
                  <Send size={14} />
                </Link>
              ),
            },
          ]}
        />
      ) : null}

      {!campaignsQuery.isLoading && pagination ? (
        <section className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={17} />
          </button>

          <span className="min-w-24 text-center text-sm font-bold text-navy-600">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={page >= totalPages}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={17} />
          </button>
        </section>
      ) : null}
    </div>
  );
}