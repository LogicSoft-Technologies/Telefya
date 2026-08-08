"use client";

import { CalendarDays, RefreshCw } from "lucide-react";

type ReportRangePickerProps = {
  from: string;
  to: string;
  loading?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
};

export function ReportRangePicker({
  from,
  to,
  loading = false,
  onFromChange,
  onToChange,
  onApply,
}: ReportRangePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-4 shadow-soft">
      <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-navy-400">
        From
        <input
          type="date"
          value={from}
          max={to}
          onChange={(event) => onFromChange(event.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold normal-case tracking-normal text-navy-900 outline-none transition focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-navy-400">
        To
        <input
          type="date"
          value={to}
          min={from}
          onChange={(event) => onToChange(event.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold normal-case tracking-normal text-navy-900 outline-none transition focus:border-telefya-blue focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-telefya-blue px-4 text-sm font-black text-white transition hover:bg-telefya-violet disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : (
          <CalendarDays size={16} />
        )}
        Apply
      </button>
    </div>
  );
}