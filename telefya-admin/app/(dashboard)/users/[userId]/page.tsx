"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MapPin,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/PageHeader";
import {
  getAdminUser,
  updateAdminUserParticipantLimit,
  updateAdminUserStatus,
} from "@/lib/api/admin";
import type { AccountStatus, AdminUser } from "@/types/admin";

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

function getFullName(user: AdminUser) {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    "Unnamed user"
  );
}

export default function UserDetailsPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const userId = decodeURIComponent(String(params.userId || ""));

  const userQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getAdminUser(userId),
    enabled: Boolean(userId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: AccountStatus) =>
      updateAdminUserStatus(userId, status),

    onSuccess: (_, status) => {
      toast.success(
        status === "active"
          ? "User account activated."
          : "User account suspended.",
      );

      void queryClient.invalidateQueries({
        queryKey: ["admin-user", userId],
      });

      void queryClient.invalidateQueries({
        queryKey: ["admin-users"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update this account.",
      );
    },
  });

  const participantLimitMutation = useMutation({
    mutationFn: (override: number | null) =>
      updateAdminUserParticipantLimit(userId, override),

    onSuccess: (_, override) => {
      toast.success(
        override === 0
          ? "Unlimited participant access enabled."
          : "Plan participant limit restored.",
      );

      void queryClient.invalidateQueries({
        queryKey: ["admin-user", userId],
      });

      void queryClient.invalidateQueries({
        queryKey: ["admin-users"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update participant access.",
      );
    },
  });

  const details = userQuery.data?.data;
  const user = details?.user;

  if (userQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-navy-100" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-white" />
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <div className="space-y-6">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-sm font-black text-navy-600 transition hover:text-telefya-blue"
        >
          <ArrowLeft size={17} />
          Back to users
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-black text-telefya-coral">
            User not available
          </h1>

          <p className="mt-2 text-sm text-red-700">
            This user could not be loaded.
          </p>

          <button
            type="button"
            onClick={() => router.push("/users")}
            className="mt-5 rounded-xl bg-telefya-coral px-4 py-2.5 text-sm font-black text-white"
          >
            Return to users
          </button>
        </div>
      </div>
    );
  }

  const status: AccountStatus =
    user.account_status === "suspended" ? "suspended" : "active";

  const isActive = status === "active";

  const hasUnlimitedParticipants =
    user.meeting_participant_limit_override === 0;

  const initials =
    getFullName(user)
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const location = [user.city, user.state, user.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-7">
      <Link
        href="/users"
        className="inline-flex items-center gap-2 text-sm font-black text-navy-600 transition hover:text-telefya-blue"
      >
        <ArrowLeft size={17} />
        Back to users
      </Link>

      <PageHeader
        eyebrow="User account"
        title={getFullName(user)}
        description={user.email}
        actions={
          <button
            type="button"
            disabled={statusMutation.isPending}
            onClick={() =>
              statusMutation.mutate(
                isActive ? "suspended" : "active",
              )
            }
            className={[
              "inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
              isActive
                ? "bg-red-50 text-telefya-coral hover:bg-red-100"
                : "bg-emerald-50 text-telefya-green hover:bg-emerald-100",
            ].join(" ")}
          >
            {isActive ? <UserX size={17} /> : <ShieldCheck size={17} />}

            {statusMutation.isPending
              ? "Updating..."
              : isActive
                ? "Suspend account"
                : "Activate account"}
          </button>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-xl font-black text-telefya-blue">
              {initials}
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-black text-navy-900">
                {getFullName(user)}
              </p>

              <span
                className={[
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black capitalize",
                  isActive
                    ? "bg-emerald-50 text-telefya-green"
                    : "bg-red-50 text-telefya-coral",
                ].join(" ")}
              >
                {isActive ? <UserCheck size={14} /> : <UserX size={14} />}
                {status}
              </span>
            </div>
          </div>

          <dl className="mt-7 space-y-4 border-t border-border pt-6 text-sm">
            <div className="flex gap-3">
              <Mail size={17} className="mt-0.5 shrink-0 text-navy-400" />
              <div className="min-w-0">
                <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                  Email
                </dt>
                <dd className="mt-1 break-all font-semibold text-navy-700">
                  {user.email}
                </dd>
              </div>
            </div>

            <div className="flex gap-3">
              <MapPin size={17} className="mt-0.5 shrink-0 text-navy-400" />
              <div>
                <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                  Location
                </dt>
                <dd className="mt-1 font-semibold text-navy-700">
                  {location || "Not provided"}
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
                  Joined
                </dt>
                <dd className="mt-1 font-semibold text-navy-700">
                  {formatDate(user.created_at, true)}
                </dd>
              </div>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-900">
            Account details
          </h2>

          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl bg-navy-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                User ID
              </dt>
              <dd className="mt-2 break-all font-mono text-xs font-bold text-navy-700">
                {user.user_id}
              </dd>
            </div>

            <div className="rounded-xl bg-navy-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                Subscription
              </dt>
              <dd className="mt-2 font-bold capitalize text-navy-700">
                {user.plan_code || "free"}
              </dd>
            </div>

            <div className="rounded-xl bg-navy-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                Email verification
              </dt>
              <dd className="mt-2 font-bold text-navy-700">
                {Boolean(user.is_verified) ? "Verified" : "Not verified"}
              </dd>
            </div>

            <div className="rounded-xl bg-navy-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.1em] text-navy-400">
                Marketing consent
              </dt>
              <dd className="mt-2 font-bold text-navy-700">
                {Boolean(user.marketing_opt_in) ? "Opted in" : "Not opted in"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-border bg-navy-50 p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-black text-navy-900">
                  Participant capacity
                </p>

                <p className="mt-1 text-sm leading-6 text-navy-500">
                  {hasUnlimitedParticipants
                    ? "Unlimited participants are enabled for meetings hosted by this account."
                    : "This account uses its subscription plan participant limit."}
                </p>
              </div>

              <button
                type="button"
                disabled={participantLimitMutation.isPending}
                onClick={() =>
                  participantLimitMutation.mutate(
                    hasUnlimitedParticipants ? null : 0,
                  )
                }
                className={[
                  "inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                  hasUnlimitedParticipants
                    ? "border border-border bg-white text-navy-800 hover:bg-navy-100"
                    : "bg-telefya-blue text-white hover:bg-telefya-violet",
                ].join(" ")}
              >
                {participantLimitMutation.isPending
                  ? "Updating..."
                  : hasUnlimitedParticipants
                    ? "Restore plan limit"
                    : "Enable unlimited"}
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}