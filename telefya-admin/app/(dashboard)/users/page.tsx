"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import {
  listAdminUsers,
  updateAdminUserStatus,
} from "@/lib/api/admin";
import type { AdminUser, AccountStatus } from "@/types/admin";

function getFullName(user: AdminUser) {
  const name = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "Unnamed user";
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

function getInitials(user: AdminUser) {
  return (
    getFullName(user)
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | AccountStatus
  >("all");
  const [page, setPage] = useState(1);

  const usersQuery = useQuery({
    queryKey: ["admin-users", page, search, statusFilter],
    queryFn: () =>
      listAdminUsers({
        page,
        limit: 25,
        search: search.trim() || undefined,
        account_status:
          statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: AccountStatus;
    }) => updateAdminUserStatus(userId, status),

    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "active"
          ? "User account activated."
          : "User account suspended.",
      );

      void queryClient.invalidateQueries({
        queryKey: ["admin-users"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["admin-dashboard"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update this user.",
      );
    },
  });

  const result = usersQuery.data?.data;
  const users = result?.users || [];
  const pagination = result?.pagination;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
    : 1;

  function updateStatusFilter(nextStatus: "all" | AccountStatus) {
    setStatusFilter(nextStatus);
    setPage(1);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform users"
        title="Users"
        description="Search accounts, review access, and manage account status."
      />

      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
            />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, or user ID"
              className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm text-navy-900 outline-none transition placeholder:text-navy-400 focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2">
            {(["all", "active", "suspended"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => updateStatusFilter(status)}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-bold capitalize transition",
                  statusFilter === status
                    ? "bg-navy-900 text-white"
                    : "text-navy-500 hover:bg-navy-50 hover:text-navy-900",
                ].join(" ")}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      {usersQuery.isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-[73px] animate-pulse rounded-2xl border border-border bg-white"
            />
          ))}
        </div>
      ) : null}

      {usersQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-telefya-coral">
          Unable to load users. Refresh the page and try again.
        </div>
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError ? (
        <DataTable<AdminUser>
          rows={users}
          getRowKey={(user) => String(user.user_id)}
          emptyTitle="No users match this filter"
          emptyDescription="Adjust the search or account-status filter."
          columns={[
            {
              label: "User",
              render: (user) => (
                <Link
                  href={`/users/${encodeURIComponent(String(user.user_id))}`}
                  className="group flex items-center gap-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-black text-telefya-blue">
                    {getInitials(user)}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate font-black text-navy-900 group-hover:text-telefya-blue">
                      {getFullName(user)}
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-navy-500">
                      {user.email}
                    </span>
                  </span>
                </Link>
              ),
            },
            {
              label: "Plan",
              render: (user) => (
                <span className="capitalize text-navy-600">
                  {user.plan_code || "free"}
                </span>
              ),
            },
            {
              label: "Joined",
              render: (user) => formatDate(user.created_at),
            },
            {
              label: "Status",
              render: (user) => {
                const status = user.account_status || "active";
                const active = status === "active";

                return (
                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black capitalize",
                      active
                        ? "bg-emerald-50 text-telefya-green"
                        : "bg-red-50 text-telefya-coral",
                    ].join(" ")}
                  >
                    {active ? <UserCheck size={14} /> : <UserX size={14} />}
                    {status}
                  </span>
                );
              },
            },
            {
              label: "",
              className: "text-right",
              render: (user) => {
                const status = user.account_status || "active";
                const nextStatus: AccountStatus =
                  status === "active" ? "suspended" : "active";

                const updating =
                  statusMutation.isPending &&
                  statusMutation.variables?.userId === String(user.user_id);

                return (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      statusMutation.mutate({
                        userId: String(user.user_id),
                        status: nextStatus,
                      })
                    }
                    className={[
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                      nextStatus === "active"
                        ? "bg-emerald-50 text-telefya-green hover:bg-emerald-100"
                        : "bg-red-50 text-telefya-coral hover:bg-red-100",
                    ].join(" ")}
                  >
                    {nextStatus === "active" ? (
                      <ShieldCheck size={15} />
                    ) : (
                      <UserX size={15} />
                    )}

                    {updating
                      ? "Updating..."
                      : nextStatus === "active"
                        ? "Activate"
                        : "Suspend"}
                  </button>
                );
              },
            },
          ]}
        />
      ) : null}

      {!usersQuery.isLoading && pagination ? (
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-navy-500">
            <Users size={16} />
            Showing {users.length} of {pagination.total} users.
          </p>

          <div className="flex items-center gap-2">
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
          </div>
        </section>
      ) : null}
    </div>
  );
}