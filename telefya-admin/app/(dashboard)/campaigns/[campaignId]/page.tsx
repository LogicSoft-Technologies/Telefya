"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Mail,
  Send,
  SquareX,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/admin/PageHeader";
import {
  cancelCampaignDelivery,
  getCampaign,
  queueCampaignDelivery,
} from "@/lib/api/admin";
import type {
  AdminCampaignDetails,
  AudienceFilters,
} from "@/types/admin";

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(
    "en",
    withTime
      ? {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
  ).format(date);
}

function getDefaultScheduleTime() {
  const date = new Date(Date.now() + 15 * 60 * 1000);
  date.setSeconds(0, 0);

  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function describeFilters(filters: AudienceFilters) {
  const labels: string[] = [];

  if (filters.account_status) {
    labels.push(
      filters.account_status === "active"
        ? "Active accounts"
        : "Suspended accounts",
    );
  }

  if (filters.verified === true) labels.push("Verified email");
  if (filters.marketing_opt_in === true) labels.push("Marketing opt-in");
  if (filters.country) labels.push(filters.country);
  if (filters.plan_code) labels.push(`${filters.plan_code} plan`);

  return labels.length ? labels.join(" · ") : "All eligible users";
}

function getRecipientCount(
  campaign: AdminCampaignDetails,
  status: string,
) {
  const count = campaign.recipient_counts?.find(
    (item) => item.delivery_status === status,
  )?.total;

  return Number(count || 0);
}

function statusCopy(campaign: AdminCampaignDetails) {
  switch (campaign.status) {
    case "scheduled":
      return `Scheduled for ${formatDate(campaign.scheduled_for, true)}.`;
    case "sending":
      return "Delivery is in progress. Counts update automatically.";
    case "sent":
      return `Delivery finished ${formatDate(campaign.sent_at, true)}.`;
    case "failed":
      return "Delivery finished without a successful email.";
    case "cancelled":
      return "This campaign was cancelled before delivery completed.";
    default:
      return "This draft has not been scheduled or sent.";
  }
}

function statusClass(status?: string) {
  switch (status) {
    case "sent":
      return "bg-emerald-100 text-emerald-700";
    case "sending":
      return "bg-blue-100 text-telefya-blue";
    case "scheduled":
      return "bg-violet-100 text-violet-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-navy-100 text-navy-600";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export default function CampaignDetailsPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = decodeURIComponent(String(params.campaignId || ""));
  const queryClient = useQueryClient();

  const [scheduleTime, setScheduleTime] = useState(
    getDefaultScheduleTime,
  );
  const [actionError, setActionError] = useState("");

  const campaignQuery = useQuery({
    queryKey: ["admin-campaign", campaignId],
    queryFn: () => getCampaign(campaignId),
    enabled: Boolean(campaignId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;

      if (status === "sending") return 5_000;
      if (status === "scheduled") return 30_000;

      return false;
    },
  });

  const refreshCampaign = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admin-campaign", campaignId],
    });

    await queryClient.invalidateQueries({
      queryKey: ["admin-campaigns"],
    });
  };

  const deliveryMutation = useMutation({
    mutationFn: (payload: {
      delivery_mode: "now" | "scheduled";
      scheduled_for?: string;
    }) => queueCampaignDelivery(campaignId, payload),
    onSuccess: refreshCampaign,
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update campaign delivery.",
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelCampaignDelivery(campaignId),
    onSuccess: refreshCampaign,
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to cancel this campaign.",
      );
    },
  });

  const campaign = campaignQuery.data?.data;

  const sendingAction =
    deliveryMutation.isPending || cancelMutation.isPending;

  const deliverySummary = useMemo(() => {
    if (!campaign) {
      return {
        queued: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
    }

    return {
      queued: getRecipientCount(campaign, "queued"),
      sending: getRecipientCount(campaign, "sending"),
      sent: getRecipientCount(campaign, "sent"),
      failed: getRecipientCount(campaign, "failed"),
      skipped: getRecipientCount(campaign, "skipped"),
    };
  }, [campaign]);

  if (campaignQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-navy-100" />
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-white" />
      </div>
    );
  }

  if (campaignQuery.isError || !campaign) {
    return (
      <div className="space-y-6">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 text-sm font-black text-navy-600 transition hover:text-telefya-blue"
        >
          <ArrowLeft size={17} />
          Back to campaigns
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-black text-red-700">
            Campaign not available
          </h1>
          <p className="mt-2 text-sm text-red-700">
            This campaign could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const canQueue =
    campaign.status === "draft" || campaign.status === "scheduled";

  const canCancel =
    campaign.status === "draft" || campaign.status === "scheduled";

  const totalResolved =
    deliverySummary.sent +
    deliverySummary.failed +
    deliverySummary.skipped;

  const deliveryPercent =
    campaign.total_recipients && campaign.total_recipients > 0
      ? Math.min(
          100,
          Math.round((totalResolved / campaign.total_recipients) * 100),
        )
      : 0;

  function sendNow() {
    if (!campaign) return;

    setActionError("");

    const confirmed = window.confirm(
      `Send "${campaign.name}" to ${
        campaign.total_recipients || 0
      } recipient(s) now? This action starts the delivery queue.`,
    );

    if (!confirmed) return;

    deliveryMutation.mutate({
      delivery_mode: "now",
    });
  }

  function scheduleDelivery() {
    setActionError("");

    const scheduledFor = new Date(scheduleTime);

    if (
      Number.isNaN(scheduledFor.getTime()) ||
      scheduledFor.getTime() <= Date.now()
    ) {
      setActionError("Choose a future delivery date and time.");
      return;
    }

    deliveryMutation.mutate({
      delivery_mode: "scheduled",
      scheduled_for: scheduledFor.toISOString(),
    });
  }

  function cancelDelivery() {
    setActionError("");

    const confirmed = window.confirm(
      "Cancel this campaign? No new recipients will receive this email.",
    );

    if (!confirmed) return;

    cancelMutation.mutate();
  }

  return (
    <div className="space-y-7">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm font-black text-navy-600 transition hover:text-telefya-blue"
      >
        <ArrowLeft size={17} />
        Back to campaigns
      </Link>

      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <PageHeader
          eyebrow="Campaign"
          title={campaign.name || "Untitled campaign"}
          description={campaign.subject || "No email subject"}
        />

        <span
          className={[
            "inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-black capitalize",
            statusClass(campaign.status),
          ].join(" ")}
        >
          {campaign.status || "draft"}
        </span>
      </div>

      {actionError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p>{actionError}</p>
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
          <div className="border-b border-border bg-navy-50/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
                <Mail size={19} />
              </span>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-navy-400">
                  Email preview
                </p>
                <p className="mt-1 font-black text-navy-900">
                  {campaign.subject || "No subject"}
                </p>

                {campaign.preheader ? (
                  <p className="mt-1 text-xs text-navy-500">
                    {campaign.preheader}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-72 whitespace-pre-wrap px-6 py-7 text-sm leading-7 text-navy-700">
            {campaign.text_content ||
              "No readable message content was saved for this campaign."}
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
            <h2 className="font-black text-navy-900">
              Delivery controls
            </h2>

            <p className="mt-2 text-sm leading-6 text-navy-500">
              {statusCopy(campaign)}
            </p>

            {canQueue ? (
              <>
                <button
                  type="button"
                  onClick={sendNow}
                  disabled={sendingAction}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-telefya-blue px-4 py-3 text-sm font-black text-white transition hover:bg-telefya-violet disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={16} />
                  {deliveryMutation.isPending
                    ? "Starting delivery..."
                    : "Send now"}
                </button>

                <div className="mt-5 border-t border-border pt-5">
                  <label
                    htmlFor="schedule-time"
                    className="text-xs font-black uppercase tracking-[0.1em] text-navy-500"
                  >
                    Schedule delivery
                  </label>

                  <input
                    id="schedule-time"
                    type="datetime-local"
                    value={scheduleTime}
                    min={getDefaultScheduleTime()}
                    onChange={(event) =>
                      setScheduleTime(event.target.value)
                    }
                    disabled={sendingAction}
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-bold text-navy-800 outline-none transition focus:border-telefya-blue focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-navy-50"
                  />

                  <button
                    type="button"
                    onClick={scheduleDelivery}
                    disabled={sendingAction}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-black text-navy-800 transition hover:border-telefya-blue hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CalendarClock size={16} />
                    Schedule campaign
                  </button>
                </div>
              </>
            ) : null}

            {canCancel ? (
              <button
                type="button"
                onClick={cancelDelivery}
                disabled={sendingAction}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SquareX size={16} />
                {cancelMutation.isPending
                  ? "Cancelling..."
                  : "Cancel campaign"}
              </button>
            ) : null}

            {!canQueue && !canCancel ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-navy-50 p-4">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-telefya-green"
                />
                <p className="text-xs leading-5 text-navy-600">
                  Delivery controls are locked once this campaign has
                  started or completed.
                </p>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
            <h2 className="font-black text-navy-900">Campaign details</h2>

            <dl className="mt-5 space-y-5 text-sm">
              <div className="flex gap-3">
                <Users
                  size={17}
                  className="mt-0.5 shrink-0 text-navy-400"
                />
                <div>
                  <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                    Audience
                  </dt>
                  <dd className="mt-1 font-bold text-navy-700">
                    {describeFilters(campaign.audience_filter || {})}
                  </dd>
                </div>
              </div>

              <div className="flex gap-3">
                <Mail
                  size={17}
                  className="mt-0.5 shrink-0 text-navy-400"
                />
                <div>
                  <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                    Recipient snapshot
                  </dt>
                  <dd className="mt-1 font-bold text-navy-700">
                    {new Intl.NumberFormat().format(
                      campaign.total_recipients || 0,
                    )}{" "}
                    recipients
                  </dd>
                </div>
              </div>

              <div className="flex gap-3">
                <CalendarDays
                  size={17}
                  className="mt-0.5 shrink-0 text-navy-400"
                />
                <div>
                  <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                    Created
                  </dt>
                  <dd className="mt-1 font-bold text-navy-700">
                    {formatDate(campaign.created_at, true)}
                  </dd>
                </div>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl bg-navy-900 p-6 text-white shadow-enterprise">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Delivery progress</h2>

              {campaign.status === "sending" ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70">
                  <Clock3 size={14} className="animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-telefya-green transition-all duration-500"
                style={{ width: `${deliveryPercent}%` }}
              />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-lg font-black">
                  {deliverySummary.queued + deliverySummary.sending}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Pending
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-lg font-black text-telefya-green">
                  {deliverySummary.sent}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Sent
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-lg font-black text-telefya-coral">
                  {deliverySummary.failed}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Failed
                </p>
              </div>
            </div>

            {deliverySummary.skipped > 0 ? (
              <p className="mt-4 text-xs leading-5 text-white/60">
                {deliverySummary.skipped} recipient(s) were skipped because
                they unsubscribed or their account was no longer active.
              </p>
            ) : null}

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-telefya-green"
              />
              <p className="text-xs leading-5 text-white/70">
                Delivery rechecks marketing consent immediately before every
                email is sent.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}