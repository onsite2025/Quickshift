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
  onAssign,
  onShiftClick,
}: {
  nurses: Nurse[];
  shifts: Shift[];
  days?: number;
  onAssign?: (shiftId: string, nurseId: string) => void | Promise<void>;
  onShiftClick?: (shift: Shift) => void;
}) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dragShiftId, setDragShiftId] = useState<string | null>(null);
  const [dragOverNurseId, setDragOverNurseId] = useState<string | null>(null);

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

      <div>
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-20 border-b border-ink-200/70 bg-white px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-500 sm:w-32 sm:px-3 sm:py-3 sm:text-xs lg:w-52 lg:px-4">
                <span className="hidden sm:inline">Clinician</span>
                <span className="sm:hidden">Nurse</span>
              </th>
              {dayList.map((d) => {
                const today = isSameDay(d, new Date());
                return (
                  <th
                    key={d.toISOString()}
                    className={`border-b border-ink-200/70 px-0.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider sm:px-2 sm:py-3 sm:text-xs lg:px-3 ${
                      today ? "text-brand-700" : "text-ink-500"
                    }`}
                  >
                    <div className="flex flex-col leading-tight">
                      <span className="sm:hidden">{format(d, "EEEEE")}</span>
                      <span className="hidden sm:inline">{format(d, "EEE")}</span>
                      <span className="text-sm font-semibold normal-case tracking-normal text-ink-900 lg:text-base">
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
                <td className="sticky left-0 z-10 w-20 border-b border-ink-100 bg-amber-50/40 px-2 py-2 sm:w-32 sm:px-3 sm:py-3 lg:w-52 lg:px-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 sm:text-xs">
                    Open
                  </div>
                  <div className="hidden text-[11px] text-amber-800/80 sm:block">awaiting claim</div>
                </td>
                {dayList.map((d) => {
                  const dayKey = format(d, "yyyy-MM-dd");
                  const cellShifts = shiftLookup.get(`__open__|${dayKey}`) ?? [];
                  return (
                    <td
                      key={dayKey}
                      className="border-b border-ink-100 bg-amber-50/30 px-0.5 py-1.5 align-top sm:px-1.5 sm:py-2 lg:px-2"
                    >
                      <div className="space-y-1">
                        {cellShifts.map((s) => (
                          <ShiftPill
                            key={s.id}
                            shift={s}
                            draggable={Boolean(onAssign)}
                            onClick={onShiftClick ? () => onShiftClick(s) : undefined}
                            onDragStart={(e) => {
                              if (!s.id) return;
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", s.id);
                              setDragShiftId(s.id);
                            }}
                            onDragEnd={() => {
                              setDragShiftId(null);
                              setDragOverNurseId(null);
                            }}
                          />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}

            {nurses.map((nurse) => {
              const isDropTarget =
                onAssign && dragShiftId && dragOverNurseId === nurse.id;
              const dragShift = dragShiftId
                ? shifts.find((s) => s.id === dragShiftId)
                : null;
              const compatible =
                !dragShift || dragShift.role === nurse.role;
              const rowHighlight = isDropTarget
                ? compatible
                  ? "bg-emerald-50/60"
                  : "bg-rose-50/40"
                : "hover:bg-ink-50/40";

              const onCellDragOver = (e: React.DragEvent) => {
                if (!onAssign || !dragShiftId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = compatible ? "move" : "none";
                if (dragOverNurseId !== nurse.id) {
                  setDragOverNurseId(nurse.id ?? null);
                }
              };
              const onCellDrop = async (e: React.DragEvent) => {
                if (!onAssign) return;
                e.preventDefault();
                const shiftId = e.dataTransfer.getData("text/plain");
                setDragShiftId(null);
                setDragOverNurseId(null);
                if (!shiftId || !nurse.id) return;
                await onAssign(shiftId, nurse.id);
              };

              return (
                <tr key={nurse.id} className={`transition-colors ${rowHighlight}`}>
                  <td className="sticky left-0 z-10 w-20 border-b border-ink-100 bg-white px-2 py-2 sm:w-32 sm:px-3 sm:py-3 lg:w-52 lg:px-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 lg:flex">
                        {initials(`${nurse.firstName} ${nurse.lastName}`)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-ink-900 sm:text-sm lg:text-[15px]">
                          {nurse.firstName} {nurse.lastName}
                        </div>
                        <div className="text-[10px] text-ink-500 sm:text-xs">
                          {nurse.role}
                        </div>
                      </div>
                    </div>
                  </td>
                  {dayList.map((d) => {
                    const dayKey = format(d, "yyyy-MM-dd");
                    const cellShifts = shiftLookup.get(`${nurse.id}|${dayKey}`) ?? [];
                    return (
                      <td
                        key={dayKey}
                        onDragOver={onCellDragOver}
                        onDrop={onCellDrop}
                        className="border-b border-ink-100 px-0.5 py-1.5 align-top sm:px-1.5 sm:py-2 lg:px-2"
                      >
                        <div className="space-y-1">
                          {cellShifts.map((s) => (
                            <ShiftPill
                              key={s.id}
                              shift={s}
                              onClick={onShiftClick ? () => onShiftClick(s) : undefined}
                              draggable={Boolean(onAssign) && s.status === "confirmed"}
                              onDragStart={(e) => {
                                if (!s.id) return;
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", s.id);
                                setDragShiftId(s.id);
                              }}
                              onDragEnd={() => {
                                setDragShiftId(null);
                                setDragOverNurseId(null);
                              }}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

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

function ShiftPill({
  shift,
  draggable = false,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  shift: Shift;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const cls = STATUS_COLOR[shift.status];
  const hours = `${formatShiftHour(shift.start.toDate())}–${formatShiftHour(shift.end.toDate())}`;
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex flex-col overflow-hidden rounded-md px-1 py-0.5 text-[10px] ring-1 ring-inset sm:px-2 sm:py-1.5 sm:text-[11px] ${cls} ${
        onClick ? "cursor-pointer hover:ring-2" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      title={
        draggable
          ? `Drag to a clinician, or tap for actions · ${shift.facilityName} • ${shift.role} • ${shift.shiftLabel}`
          : onClick
            ? `Tap for actions · ${shift.facilityName} • ${shift.role} • ${shift.shiftLabel}`
            : `${shift.facilityName} • ${shift.role} • ${shift.shiftLabel} • ${shift.status}`
      }
    >
      <span className="truncate text-center font-semibold leading-tight sm:text-left">
        <span className="sm:hidden">{shift.shiftCode}</span>
        <span className="hidden sm:inline">
          {shift.role} · {shift.shiftCode}
        </span>
      </span>
      <span className="hidden truncate leading-tight opacity-90 sm:inline">
        {hours}
      </span>
      <span className="hidden truncate leading-tight opacity-70 sm:inline">
        {shift.facilityName}
      </span>
    </div>
  );
}
