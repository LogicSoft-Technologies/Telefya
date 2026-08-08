import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: ReactNode;
  detail?: string;
  tone?: "blue" | "green" | "violet" | "coral";
};

const toneClasses = {
  blue: "bg-blue-50 text-telefya-blue",
  green: "bg-emerald-50 text-telefya-green",
  violet: "bg-violet-50 text-telefya-violet",
  coral: "bg-red-50 text-telefya-coral",
};

export function MetricCard({
  label,
  value,
  icon,
  detail,
  tone = "blue",
}: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-enterprise">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-navy-400">
            {label}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-navy-900">
            {value}
          </p>
        </div>

        <span
          className={[
            "grid h-11 w-11 place-items-center rounded-xl",
            toneClasses[tone],
          ].join(" ")}
        >
          {icon}
        </span>
      </div>

      {detail ? (
        <p className="mt-4 text-sm font-medium text-navy-500">{detail}</p>
      ) : null}
    </article>
  );
}