"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/PageHeader";
import {
  createCampaign,
  listAudienceSegments,
  previewAudience,
} from "@/lib/api/admin";
import type { AudienceSegment } from "@/types/admin";

const STARTER_MESSAGE = `Hi {{first_name}},

We have an update from Telefya.

Use this space to share a clear announcement, product update, event invitation, or important account news with your audience.

Best,
The Telefya Team`;

function textToSafeHtml(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => {
      const safeParagraph = paragraph
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br />");

      return `<p style="margin:0 0 18px;">${safeParagraph}</p>`;
    })
    .join("");
}

function describeAudience(segment?: AudienceSegment) {
  if (!segment) return "";

  const filters = segment.filters || {};
  const labels: string[] = [];

  if (filters.account_status === "active") labels.push("Active accounts");
  if (filters.verified === true) labels.push("Verified email");
  if (filters.country) labels.push(filters.country);
  if (filters.plan_code) labels.push(`${filters.plan_code} plan`);

  return labels.length ? labels.join(" · ") : "Saved audience filters";
}

export default function NewCampaignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [message, setMessage] = useState(STARTER_MESSAGE);
  const [segmentId, setSegmentId] = useState("");

  const segmentsQuery = useQuery({
    queryKey: ["admin-audience-segments"],
    queryFn: listAudienceSegments,
  });

  const segments = (segmentsQuery.data?.data || []) as AudienceSegment[];

  const selectedSegment = useMemo(
    () => segments.find((segment) => String(segment.id) === segmentId),
    [segmentId, segments],
  );

  const previewQuery = useQuery({
    queryKey: [
      "admin-audience-preview",
      selectedSegment?.id,
      selectedSegment?.filters,
    ],
    queryFn: () =>
      previewAudience({
        filters: selectedSegment?.filters || {},
        marketing_only: true,
      }),
    enabled: Boolean(selectedSegment),
  });

  const recipientCount = previewQuery.data?.data?.total || 0;

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedSegment) {
        throw new Error("Choose a valid saved audience.");
      }

      return createCampaign({
        name: name.trim(),
        subject: subject.trim(),
        preheader: preheader.trim() || undefined,
        text_content: message.trim(),
        html_content: textToSafeHtml(message),
        filters: selectedSegment.filters || {},
        status: "draft",
      });
    },

    onSuccess: (response) => {
      toast.success("Campaign draft created.");

      void queryClient.invalidateQueries({
        queryKey: ["admin-campaigns"],
      });

      router.replace(
        `/campaigns/${encodeURIComponent(String(response.data.id))}`,
      );
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create this campaign.",
      );
    },
  });

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Enter a campaign name.");
      return;
    }

    if (!subject.trim()) {
      toast.error("Enter an email subject.");
      return;
    }

    if (!message.trim()) {
      toast.error("Write the email message.");
      return;
    }

    if (!selectedSegment) {
      toast.error("Choose a recipient audience.");
      return;
    }

    if (!previewQuery.isLoading && recipientCount === 0) {
      toast.error(
        "This audience has no active users opted in to marketing emails.",
      );
      return;
    }

    createMutation.mutate();
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

      <PageHeader
        eyebrow="Communications"
        title="New campaign"
        description="Create a reviewed newsletter draft. Delivery is configured separately."
      />

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-black text-navy-700">
                Campaign name
              </span>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={150}
                placeholder="e.g. August product update"
                className="mt-2 h-11 w-full rounded-xl border border-border px-3 text-sm text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-navy-700">
                Email subject
              </span>

              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={255}
                placeholder="What recipients see in their inbox"
                className="mt-2 h-11 w-full rounded-xl border border-border px-3 text-sm text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-navy-700">
                Preview text{" "}
                <span className="font-medium text-navy-400">(optional)</span>
              </span>

              <input
                value={preheader}
                onChange={(event) => setPreheader(event.target.value)}
                maxLength={255}
                placeholder="Short text displayed after the subject in inboxes"
                className="mt-2 h-11 w-full rounded-xl border border-border px-3 text-sm text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-black text-navy-700">
                  Message
                </span>

                <button
                  type="button"
                  onClick={() => setMessage(STARTER_MESSAGE)}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-telefya-blue transition hover:text-telefya-violet"
                >
                  <Sparkles size={14} />
                  Use Telefya starter
                </button>
              </div>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={17}
                maxLength={25_000}
                placeholder="Write your newsletter here..."
                className="mt-2 w-full resize-y rounded-xl border border-border px-3 py-3 text-sm leading-6 text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs leading-5 text-navy-500">
                You can personalize messages with{" "}
                <code className="font-bold text-navy-700">
                  {"{{first_name}}"}
                </code>
                ,{" "}
                <code className="font-bold text-navy-700">
                  {"{{last_name}}"}
                </code>
                ,{" "}
                <code className="font-bold text-navy-700">
                  {"{{full_name}}"}
                </code>
                , and{" "}
                <code className="font-bold text-navy-700">
                  {"{{email}}"}
                </code>
                .
              </p>
            </div>
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-telefya-violet">
                <Users size={19} />
              </span>

              <div>
                <h2 className="font-black text-navy-900">Recipients</h2>
                <p className="mt-1 text-sm text-navy-500">
                  Select a saved audience.
                </p>
              </div>
            </div>

            <select
              value={segmentId}
              onChange={(event) => setSegmentId(event.target.value)}
              disabled={segmentsQuery.isLoading}
              className="mt-5 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy-700 outline-none transition focus:border-telefya-blue focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {segmentsQuery.isLoading
                  ? "Loading audiences..."
                  : "Select an audience"}
              </option>

              {segments.map((segment) => (
                <option key={String(segment.id)} value={String(segment.id)}>
                  {segment.name}
                </option>
              ))}
            </select>

            {selectedSegment ? (
              <div className="mt-4 rounded-xl bg-navy-50 p-4">
                <p className="text-xs font-black text-navy-800">
                  {selectedSegment.name}
                </p>

                <p className="mt-1 text-xs leading-5 text-navy-500">
                  {describeAudience(selectedSegment)}
                </p>

                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                    Eligible recipients
                  </p>

                  <p className="mt-1 text-2xl font-black text-navy-900">
                    {previewQuery.isLoading
                      ? "..."
                      : new Intl.NumberFormat().format(recipientCount)}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-navy-500">
                    Active users who are currently opted in to marketing.
                  </p>
                </div>
              </div>
            ) : null}

            {previewQuery.isError ? (
              <p className="mt-3 text-xs leading-5 text-red-700">
                The recipient preview could not be loaded. Try again before
                saving.
              </p>
            ) : null}

            {!segmentsQuery.isLoading && !segments.length ? (
              <p className="mt-3 text-xs leading-5 text-telefya-coral">
                Create an audience before creating a campaign.
              </p>
            ) : null}

            <Link
              href="/audiences"
              className="mt-4 inline-flex text-xs font-black text-telefya-blue transition hover:text-telefya-violet"
            >
              Manage audiences
            </Link>
          </article>

          <article className="rounded-2xl bg-navy-900 p-6 text-white shadow-enterprise">
            <FileText size={21} className="text-telefya-green" />

            <h2 className="mt-4 font-black">Save for review</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              A draft preserves an audience snapshot and opens the delivery
              controls. Nothing is emailed from this page.
            </p>

            <button
              type="button"
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                previewQuery.isLoading ||
                Boolean(selectedSegment && recipientCount === 0)
              }
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-navy-900 transition hover:bg-navy-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending ? (
                "Saving draft..."
              ) : (
                <>
                  <Mail size={17} />
                  Save campaign draft
                </>
              )}
            </button>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-telefya-green"
              />
              <p className="text-sm leading-6 text-navy-600">
                The final email automatically uses the Telefya logo, branded
                layout, recipient personalization, and an unsubscribe link.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}