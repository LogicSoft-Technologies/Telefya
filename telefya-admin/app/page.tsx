import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

const capabilities = [
  {
    title: "Platform",
    icon: BarChart3,
    tint: "bg-telefya-blue/10 text-telefya-blue",
  },
  {
    title: "Users",
    icon: Users,
    tint: "bg-telefya-violet/10 text-telefya-violet",
  },
  {
    title: "Campaigns",
    icon: Mail,
    tint: "bg-telefya-green/10 text-telefya-green",
  },
];

export default function HomePage() {
  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-b from-white via-surface-soft to-[#eff4ff]">
      <div className="pointer-events-none absolute -right-48 -top-96 h-[680px] w-[680px] rounded-full bg-[radial-gradient(circle,rgba(100,38,255,0.18)_0%,rgba(15,107,255,0.08)_38%,transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-96 -left-64 h-[680px] w-[680px] rounded-full bg-[radial-gradient(circle,rgba(15,107,255,0.13)_0%,rgba(34,211,134,0.06)_42%,transparent_70%)]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1200px] flex-col px-7 py-8">
        <header className="flex shrink-0 items-center justify-between gap-6">
          <div className="inline-flex items-center gap-3.5">
            <Image
              src="/images/telefya-logo.png"
              alt="Telefya"
              width={154}
              height={44}
              priority
              className="h-9 w-auto"
            />

            <span className="h-7 w-px bg-border" />

            <span className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-navy-400">
              Admin
            </span>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-telefya-green/20 bg-emerald-50/80 px-3.5 py-2 text-xs font-extrabold text-emerald-700">
            <ShieldCheck size={15} />
            Restricted
          </span>
        </header>

        <div className="flex min-h-0 flex-1 items-center gap-14">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.13em] text-telefya-violet">
              <span className="h-2 w-2 rounded-full bg-telefya-green shadow-[0_0_0_5px_rgba(34,211,134,0.12)]" />
              Control center
            </div>

            <h1 className="mt-5 max-w-[720px] font-[Manrope] text-[clamp(3rem,6vw,5.5rem)] font-extrabold leading-[0.98] tracking-tight text-navy-900">
              Manage Telefya
              <span className="block bg-gradient-to-r from-telefya-blue via-telefya-violet to-telefya-purple bg-clip-text text-transparent">
                from one place.
              </span>
            </h1>

            <p className="mt-6 text-lg font-medium text-navy-400">
              Platform operations, users, and campaigns.
            </p>

            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-telefya-blue to-telefya-violet px-6 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(69,70,218,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(69,70,218,0.32)] active:scale-[0.98]"
              >
                Sign in
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="grid w-[360px] shrink-0 gap-4">
            {capabilities.map((capability) => {
              const Icon = capability.icon;

              return (
                <article
                  key={capability.title}
                  className="flex items-center gap-4 rounded-[18px] border border-border bg-white/80 p-5 shadow-soft backdrop-blur-md"
                >
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${capability.tint}`}
                  >
                    <Icon size={21} />
                  </div>

                  <h2 className="font-[Manrope] text-[15px] font-extrabold text-navy-900">
                    {capability.title}
                  </h2>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="shrink-0 pt-4 text-center text-xs font-semibold text-navy-300">
          Authorized personnel only
        </footer>
      </div>
    </main>
  );
}