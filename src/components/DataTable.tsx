interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T extends { id?: string }>({
  rows,
  columns,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="card-flush">
      {/* Desktop / tablet: table */}
      <table className="hidden table-base sm:table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className={c.className}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100/80 bg-white">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer" : ""}
            >
              {columns.map((c) => (
                <td key={String(c.key)} className={c.className}>
                  {c.render
                    ? c.render(row)
                    : String((row as Record<string, unknown>)[c.key as string] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: each row as a card with label / value pairs */}
      <ul className="divide-y divide-ink-100/80 sm:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`px-4 py-3 ${onRowClick ? "active:bg-ink-50" : ""}`}
          >
            <dl className="space-y-1.5">
              {columns
                .filter((c) => c.header !== "")
                .map((c) => {
                  const value = c.render
                    ? c.render(row)
                    : String((row as Record<string, unknown>)[c.key as string] ?? "");
                  return (
                    <div
                      key={String(c.key)}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                        {c.header}
                      </dt>
                      <dd className="min-w-0 text-right text-sm text-ink-700">
                        {value}
                      </dd>
                    </div>
                  );
                })}
              {/* Action column (header is "") rendered un-labeled at the bottom */}
              {columns
                .filter((c) => c.header === "")
                .map((c) => (
                  <div key={String(c.key)} className="flex justify-end pt-1">
                    {c.render ? c.render(row) : null}
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
