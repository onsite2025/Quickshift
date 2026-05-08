"use client";

import { useMemo, useState } from "react";
import { addDays, format, startOfWeek, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Nurse, Shift, ShiftStatus } from "@/types";
import { initials, formatShiftHour } from "@/lib/utils";

const STATUS_COLOR: Record<ShiftStatus, string> = {
  draft: "bg-ink-100 text-ink-700 ring-ink-200",
  broadcasting: "bg-amber-50 text-amber-700 ring-amber-200",
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  claimed: "bg-blue-50 text-blue-700 ring-blue-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  in_progress: "bg-brand-50 text-brand-700 ring-brand-200",
  completed: "bg-ink-50 text-ink-600 ring-ink-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function ShiftGrid({
  nurses,
  shifts,
  days = 7,
}: {
  nurses: Nurse[];
  shifts: Shift[];
  days?: number;
}) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(anchor, i)),
    [anchor, days],
  );

  const shiftLookup = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      // Cancelled shifts shouldn't show on the coverage grid at all.
      if (s.status === "cancelled") continue;
      // Use the shift's stored `date` field (already facility-local YYYY-MM-DD)
      // so day-bucketing isn't affected by the viewer's timezone.
      const dayKey = s.date;
      const nurseKey = s.nurseId ?? "__open__";
      const key = `${nurseKey}|${dayKey}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [shifts]);

  const openShifts = useMemo(
    () =>
      shifts.filter(
        (s) => !s.nurseId && (s.status === "open" || s.status === "broadcasting"),
      ),
    [shifts],
  );

  return (
    <div className="card-flush">
      <div className="flex items-center justify-between border-b border-ink-200/70 px-5 py-3">
        <div>
          <h3 className="text-base font-semibold text-ink-900">Coverage grid</h3>
          <p className="text-xs text-ink-500">
            {format(dayList[0]!, "MMM d")} – {format(dayList[dayList.length - 1]!, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost px-2"
            onClick={() => setAnchor(addDays(anchor, -days))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="btn-ghost"
            onClick={() => setAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            This week
          </button>
          <button
            className="btn-ghost px-2"
            onClick={() => setAnchor(addDays(anchor, days))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-56 border-b border-ink-200/70 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                Clinician
              </th>
              {dayList.map((d) => {
                const today = isSameDay(d, new Date());
                return (
                  <th
                    key={d.toISOString()}
                    className={`border-b border-ink-200/70 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                      today ? "text-brand-700" : "text-ink-500"
                    }`}
                  >
                    <div className="flex flex-col leading-tight">
                      <span>{format(d, "EEE")}</span>
                      <span className="text-base font-semibold normal-case tracking-normal text-ink-900">
                        {format(d, "d")}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {openShifts.length > 0 && (
              <tr>
                <td className="sticky left-0 z-10 border-b border-ink-100 bg-amber-50/40 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Open shifts
                  </div>
                  <div className="text-[11px] text-amber-800/80">awaiting claim</div>
                </td>
                {dayList.map((d) => {
                  const dayKey = format(d, "yyyy-MM-dd");
                  const cellShifts = shiftLookup.get(`__open__|${dayKey}`) ?? [];
                  return (
                    <td
                      key={dayKey}
                      className="min-w-[140px] border-b border-ink-100 bg-amber-50/30 px-2 py-2 align-top"
                    >
                      <div className="space-y-1">
                        {cellShifts.map((s) => (
                          <ShiftPill key={s.id} shift={s} />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}

            {nurses.map((nurse) => (
              <tr key={nurse.id} className="hover:bg-ink-50/40">
                <td className="sticky left-0 z-10 w-56 border-b border-ink-100 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                      {initials(`${nurse.firstName} ${nurse.lastName}`)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink-900">
                        {nurse.firstName} {nurse.lastName}
                      </div>
                      <div className="text-xs text-ink-500">{nurse.role}</div>
                    </div>
                  </div>
                </td>
                {dayList.map((d) => {
                  const dayKey = format(d, "yyyy-MM-dd");
                  const cellShifts = shiftLookup.get(`${nurse.id}|${dayKey}`) ?? [];
                  return (
                    <td
                      key={dayKey}
                      className="min-w-[140px] border-b border-ink-100 px-2 py-2 align-top"
                    >
                      <div className="space-y-1">
                        {cellShifts.map((s) => (
                          <ShiftPill key={s.id} shift={s} />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {nurses.length === 0 && (
              <tr>
                <td colSpan={dayList.length + 1} className="border-b border-ink-100 px-4 py-12 text-center text-sm text-ink-500">
                  No clinicians yet. Add nurses to populate the grid.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShiftPill({ shift }: { shift: Shift }) {
  const cls = STATUS_COLOR[shift.status];
  const hours = `${formatShiftHour(shift.start.toDate())}–${formatShiftHour(shift.end.toDate())}`;
  return (
    <div
      className={`flex flex-col rounded-md px-2 py-1.5 text-[11px] ring-1 ring-inset ${cls}`}
      title={`${shift.facilityName} • ${shift.role} • ${shift.shiftLabel} • ${shift.status}`}
    >
      <span className="font-semibold leading-tight">
        {shift.role} · {shift.shiftCode}
      </span>
      <span className="leading-tight opacity-90">{hours}</span>
      <span className="truncate leading-tight opacity-70">{shift.facilityName}</span>
    </div>
  );
}
