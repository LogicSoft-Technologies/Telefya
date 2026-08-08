"use client";

import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminSession } from "@/hooks/use-admin-session";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { loading } = useAdminSession();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-navy-50 px-5">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-soft">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-100 border-t-telefya-blue" />
          <span className="text-sm font-bold text-navy-700">
            Verifying administrator access…
          </span>
        </div>
      </main>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}