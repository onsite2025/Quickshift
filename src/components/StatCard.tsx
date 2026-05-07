import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
}: {
  label: string;
  value: string | number | undefined;
  icon: LucideIcon;
  delta?: { value: string; positive?: boolean };
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-ink-500">{label}</span>
        <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-ink-900">
          {value === undefined ? <span className="skeleton inline-block h-7 w-16" /> : value}
        </span>
        {delta && (
          <span
            className={`text-xs font-medium ${
              delta.positive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
