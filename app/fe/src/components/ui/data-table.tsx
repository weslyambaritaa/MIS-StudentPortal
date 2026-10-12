import type { ReactNode } from "react";

export type DataTableColumn<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  className?: string;
};

type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string | number;
  emptyMessage?: string;
  caption?: string;
};

/** Responsive semantic table using the MIS table header treatment. */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No data available.",
  caption,
}: DataTableProps<Row>) {
  return (
    <div
      className="w-full overflow-x-auto rounded-xl border border-rose-50 bg-neutral-100 p-3"
      role="region"
      aria-label={caption ?? "Data table"}
      tabIndex={0}
    >
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-3 py-2 text-sm font-medium text-gray-600 ${column.className ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(columns.length, 1)}
                className="px-3 py-8 text-center text-sm text-zinc-950/60"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-t border-rose-50 bg-white/70">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`border-t border-rose-50 px-3 py-3 text-sm text-zinc-950/80 ${column.className ?? ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
