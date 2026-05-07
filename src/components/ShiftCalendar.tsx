"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Shift } from "@/types";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ShiftCalendar({ shifts }: { shifts: Shift[] }) {
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const shiftsByDay = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = format(s.start.toDate(), "yyyy-MM-dd");
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return m;
  }, [shifts]);

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{format(cursor, "MMMM yyyy")}</h3>
        <div className="flex gap-1">
          <button
            className="btn-ghost px-2"
            onClick={() => setCursor(addDays(startOfMonth(cursor), -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="btn-ghost" onClick={() => setCursor(new Date())}>
            Today
          </button>
          <button
            className="btn-ghost px-2"
            onClick={() => setCursor(addDays(endOfMonth(cursor), 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 pb-2 text-center text-xs font-medium text-slate-500">
        {WEEK_DAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayShifts = shiftsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`min-h-[96px] bg-white p-2 text-xs ${
                inMonth ? "" : "bg-slate-50 text-slate-400"
              }`}
            >
              <div
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                  today ? "bg-brand-600 text-white" : "text-slate-700"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayShifts.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="truncate rounded bg-brand-50 px-2 py-1 text-[11px] text-brand-700"
                    title={`${s.facilityName} • ${s.role}`}
                  >
                    {format(s.start.toDate(), "h:mma")} {s.facilityName}
                  </div>
                ))}
                {dayShifts.length > 3 && (
                  <div className="text-[11px] text-slate-500">+{dayShifts.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
