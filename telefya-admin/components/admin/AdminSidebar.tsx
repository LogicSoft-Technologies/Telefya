"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileBarChart,
  Mail,
  Settings,
  Users,
  Video,
  X,
} from "lucide-react";

const navigation = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: BarChart3,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileBarChart,
  },
  {
    href: "/users",
    label: "Users",
    icon: Users,
  },
  {
    href: "/audiences",
    label: "Audiences",
    icon: Users,
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: Mail,
  },
  {
    href: "/meetings",
    label: "Meetings",
    icon: CalendarDays,
  },
  {
    href: "/recordings",
    label: "Recordings",
    icon: Video,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

type AdminSidebarProps = {
  mobile?: boolean;
  onClose?: () => void;
};

export function AdminSidebar({
  mobile = false,
  onClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={[
        "flex h-full w-[272px] flex-col border-r border-white/10 bg-[#071633] px-4 py-5 text-white",
        mobile ? "shadow-2xl" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between px-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
          onClick={onClose}
        >
          <Image
            src="/images/telefya-logo.png"
            alt="Telefya"
            width={132}
            height={40}
            priority
            className="h-auto w-[132px]"
          />
        </Link>

        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid h-9 w-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X size={19} />
          </button>
        ) : null}
      </div>

      <div className="mt-8 px-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
          Administration
        </p>
      </div>

      <nav className="mt-3 space-y-1">
        {navigation.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition",
                active
                  ? "bg-white text-navy-900 shadow-lg shadow-black/15"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <Icon
                size={18}
                className={
                  active ? "text-telefya-blue" : "text-white/55"
                }
              />

              <span className="flex-1">{item.label}</span>

              {active ? (
                <ChevronRight
                  size={16}
                  className="text-navy-400"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.05] p-4">
        <p className="text-xs font-black text-white">
          Telefya Admin
        </p>
        <p className="mt-1 text-xs leading-5 text-white/50">
          Platform operations and reporting.
        </p>
      </div>
    </aside>
  );
}