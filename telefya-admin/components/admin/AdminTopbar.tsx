"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu, ShieldCheck } from "lucide-react";

import { clearAdminSession } from "@/lib/auth/session";

type AdminTopbarProps = {
  onOpenMenu: () => void;
};

export function AdminTopbar({ onOpenMenu }: AdminTopbarProps) {
  const router = useRouter();

  function handleLogout() {
    clearAdminSession();
    router.replace("/login");
  }

  return (
    <header className="flex min-h-[76px] items-center justify-between border-b border-border bg-white/80 px-5 backdrop-blur-xl lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border text-navy-700 transition hover:bg-navy-50 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-telefya-green" />
            <span className="text-xs font-black uppercase tracking-[0.12em] text-navy-400">
              Secure workspace
            </span>
          </div>

          <p className="mt-1 text-sm font-black text-navy-900">
            Telefya Administration
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold text-navy-700 transition hover:border-telefya-coral/30 hover:bg-red-50 hover:text-telefya-coral"
      >
        <LogOut size={17} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </header>
  );
}