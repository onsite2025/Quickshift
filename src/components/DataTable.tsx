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
      <table className="table-base">
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
    </div>
  );
}
