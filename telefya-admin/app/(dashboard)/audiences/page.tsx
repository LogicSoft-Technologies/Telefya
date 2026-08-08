"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Filter,
  Mail,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/PageHeader";
import {
  createAudienceSegment,
  listAudienceSegments,
  previewAudience,
} from "@/lib/api/admin";
import type {
  AudienceFilters,
  AudiencePreview,
  AudienceSegment,
} from "@/types/admin";

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
  if (filters.verified === false) labels.push("Unverified email");
  if (filters.marketing_opt_in === true) labels.push("Marketing opt-in");

  return labels.length ? labels.join(" / ") : "All platform users";
}

export default function AudiencesPage() {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [filters, setFilters] = useState<AudienceFilters>({
    account_status: "active",
    marketing_opt_in: true,
  });

  const [preview, setPreview] = useState<AudiencePreview | null>(null);

  const segmentsQuery = useQuery({
    queryKey: ["admin-audience-segments"],
    queryFn: listAudienceSegments,
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      previewAudience({
        filters,
        marketing_only: true,
      }),

    onSuccess: (response) => {
      setPreview(response.data);
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to preview this audience.",
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAudienceSegment({
        name: name.trim(),
        description: description.trim() || undefined,
        filters,
      }),

    onSuccess: () => {
      toast.success("Audience saved.");
      setName("");
      setDescription("");
      setPreview(null);

      void queryClient.invalidateQueries({
        queryKey: ["admin-audience-segments"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save this audience.",
      );
    },
  });

  const segments = (segmentsQuery.data?.data || []) as AudienceSegment[];

  function updateFilter<Key extends keyof AudienceFilters>(
    key: Key,
    value: AudienceFilters[Key] | undefined,
  ) {
    setFilters((current) => {
      const next = { ...current };

      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }

      return next;
    });

    setPreview(null);
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Enter a name for this audience.");
      return;
    }

    createMutation.mutate();
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Audience builder"
        title="Audiences"
        description="Create reusable recipient groups for platform communications."
      />

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-telefya-violet">
              <Filter size={19} />
            </span>

            <div>
              <h2 className="font-black text-navy-900">Build an audience</h2>
              <p className="mt-1 text-sm text-navy-500">
                Filter the accounts that should receive a campaign.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-black text-navy-700">
                Audience name
              </span>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Active users in July"
                maxLength={150}
                className="mt-2 h-11 w-full rounded-xl border border-border px-3 text-sm text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-navy-700">
                Internal note{" "}
                <span className="font-medium text-navy-400">(optional)</span>
              </span>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this group for?"
                maxLength={500}
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-border px-3 py-3 text-sm text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div>
              <p className="text-sm font-black text-navy-700">
                Account status
              </p>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "Any", value: undefined },
                  { label: "Active", value: "active" as const },
                  { label: "Suspended", value: "suspended" as const },
                ].map((option) => {
                  const selected = filters.account_status === option.value;

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() =>
                        updateFilter("account_status", option.value)
                      }
                      className={[
                        "rounded-xl border px-3 py-2.5 text-xs font-black transition",
                        selected
                          ? "border-telefya-blue bg-blue-50 text-telefya-blue"
                          : "border-border text-navy-500 hover:bg-navy-50",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition hover:bg-navy-50">
              <input
                type="checkbox"
                checked={filters.verified === true}
                onChange={(event) =>
                  updateFilter(
                    "verified",
                    event.target.checked ? true : undefined,
                  )
                }
                className="mt-0.5 h-4 w-4 accent-[#0f6bff]"
              />

              <span>
                <span className="block text-sm font-black text-navy-800">
                  Verified email only
                </span>
                <span className="mt-1 block text-xs leading-5 text-navy-500">
                  Exclude accounts that have not verified their email address.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition hover:bg-navy-50">
              <input
                type="checkbox"
                checked={filters.marketing_opt_in === true}
                onChange={(event) =>
                  updateFilter(
                    "marketing_opt_in",
                    event.target.checked ? true : undefined,
                  )
                }
                className="mt-0.5 h-4 w-4 accent-[#0f6bff]"
              />

              <span>
                <span className="block text-sm font-black text-navy-800">
                  Marketing opt-in only
                </span>
                <span className="mt-1 block text-xs leading-5 text-navy-500">
                  Required for newsletter delivery.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-black text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Users size={17} />
              {previewMutation.isPending
                ? "Checking..."
                : "Preview recipients"}
            </button>

            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-telefya-blue px-4 text-sm font-black text-white transition hover:bg-telefya-violet disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={17} />
              {createMutation.isPending ? "Saving..." : "Save audience"}
            </button>
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-2xl bg-navy-900 p-6 text-white shadow-enterprise">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                  Recipient preview
                </p>

                <p className="mt-3 text-4xl font-black">
                  {preview ? preview.total.toLocaleString() : "-"}
                </p>

                <p className="mt-2 text-sm text-white/60">
                  {preview
                    ? "opted-in active accounts match these filters"
                    : "Preview before creating a campaign."}
                </p>
              </div>

              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-telefya-green">
                <Mail size={20} />
              </span>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/75">
              {describeFilters(filters)}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-white shadow-soft">
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="font-black text-navy-900">Saved audiences</h2>
                <p className="mt-1 text-sm text-navy-500">
                  Reuse the same filters for campaigns.
                </p>
              </div>

              <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-black text-navy-500">
                {segments.length}
              </span>
            </div>

            {segmentsQuery.isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl bg-navy-50"
                  />
                ))}
              </div>
            ) : null}

            {segmentsQuery.isError ? (
              <div className="p-6 text-sm font-semibold text-telefya-coral">
                Unable to load saved audiences.
              </div>
            ) : null}

            {!segmentsQuery.isLoading &&
            !segmentsQuery.isError &&
            !segments.length ? (
              <div className="p-8 text-center">
                <CheckCircle2
                  size={28}
                  className="mx-auto text-navy-300"
                />
                <p className="mt-3 text-sm font-black text-navy-800">
                  No saved audiences yet
                </p>
                <p className="mt-1 text-sm text-navy-500">
                  Build your first audience using the filters.
                </p>
              </div>
            ) : null}

            {!segmentsQuery.isLoading &&
            !segmentsQuery.isError &&
            segments.length ? (
              <div className="divide-y divide-border">
                {segments.map((segment) => (
                  <div
                    key={String(segment.id)}
                    className="flex items-start justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-navy-900">
                        {segment.name}
                      </p>

                      <p className="mt-1 text-xs text-navy-500">
                        {describeFilters(segment.filters || {})}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-navy-400">
                      {formatDate(segment.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </section>
    </div>
  );
}