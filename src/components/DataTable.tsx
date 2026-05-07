interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id?: string }>({
  rows,
  columns,
  empty = "No records yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <div className="card text-sm text-slate-500">{empty}</div>;
  }
  return (
    <div className="card overflow-hidden p-0">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td key={String(c.key)} className="px-4 py-3 text-sm text-slate-700">
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
