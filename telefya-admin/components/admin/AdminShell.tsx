"use client";

import { useState, type ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-navy-50">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <AdminSidebar />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-navy-900/55 backdrop-blur-sm"
          />

          <div className="relative h-full w-[272px]">
            <AdminSidebar mobile onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="min-h-screen lg:pl-[272px]">
        <AdminTopbar onOpenMenu={() => setMenuOpen(true)} />

        <main className="mx-auto w-full max-w-[1600px] px-5 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}