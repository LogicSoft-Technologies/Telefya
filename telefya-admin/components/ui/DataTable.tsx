import type { ReactNode } from "react";

type DataTableColumn<T> = {
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyTitle = "No results found",
  emptyDescription = "Try changing your search or filter.",
}: DataTableProps<T>) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
        <p className="font-black text-navy-900">{emptyTitle}</p>
        <p className="mt-2 text-sm text-navy-500">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="border-b border-border bg-navy-50/70">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  className={[
                    "whitespace-nowrap px-5 py-4 text-xs font-black uppercase tracking-[0.1em] text-navy-400",
                    column.className || "",
                  ].join(" ")}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="transition hover:bg-navy-50/70"
              >
                {columns.map((column) => (
                  <td
                    key={column.label}
                    className={[
                      "px-5 py-4 text-sm text-navy-700",
                      column.className || "",
                    ].join(" ")}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}