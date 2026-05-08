"use client";

import { useMemo, useState } from "react";
import { Loader2, UserCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";
import { formatShiftDateLabel, formatShiftHour, initials } from "@/lib/utils";
import type { Nurse, Shift } from "@/types";

export function ShiftActionsModal({
  shift,
  nurses,
  onClose,
  onChanged,
}: {
  shift: Shift;
  nurses: Nurse[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"" | "assign" | "cancel">("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingNurseId, setPendingNurseId] = useState<string | null>(null);

  const eligible = useMemo(
    () =>
      nurses
        .filter((n) => n.role === shift.role && n.status === "active")
        .filter((n) => n.id !== shift.nurseId),
    [nurses, shift.role, shift.nurseId, shift.status],
  );

  const dateLabel = formatShiftDateLabel(shift.start.toDate());
  const hours = `${formatShiftHour(shift.start.toDate())}–${formatShiftHour(shift.end.toDate())}`;

  const isClaimable = ["draft", "open", "broadcasting", "confirmed"].includes(
    shift.status,
  );
  const isCancellable = !["completed", "cancelled"].includes(shift.status);
  const isReassign = shift.status === "confirmed";

  const assign = async (nurseId: string) => {
    if (!auth.currentUser) {
      toast.error("Refresh and sign in again.");
      return;
    }
    setBusy("assign");
    setPendingNurseId(nurseId);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/shifts/${shift.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nurseId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Assign failed");
        return;
      }
      toast.success(data.reassigned ? "Shift reassigned" : "Shift assigned");
      onChanged();
      onClose();
    } finally {
      setBusy("");
      setPendingNurseId(null);
    }
  };

  const cancel = async () => {
    if (!auth.currentUser) {
      toast.error("Refresh and sign in again.");
      return;
    }
    if (
      !window.confirm(
        isReassign
          ? "Cancel this shift? The assigned nurse will get a heads-up SMS."
          : "Cancel this shift?",
      )
    )
      return;
    setBusy("cancel");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/shifts/${shift.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Cancel failed");
        return;
      }
      toast.success("Shift cancelled");
      onChanged();
      onClose();
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-card">
        <div className="flex shrink-0 items-start justify-between border-b border-ink-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">
              {shift.role} · {shift.shiftCode}
            </h3>
            <p className="mt-0.5 text-sm text-ink-500">
              {dateLabel} · {hours} · {shift.facilityName}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-ink-500">Status:</span>
            <span className="badge bg-ink-100 capitalize text-ink-700 ring-ink-200">
              {shift.status.replace("_", " ")}
            </span>
            {shift.nurseName && (
              <>
                <span className="text-ink-400">·</span>
                <span className="text-ink-700">
                  Currently {isReassign ? "assigned to" : "with"}{" "}
                  <span className="font-medium">{shift.nurseName}</span>
                </span>
              </>
            )}
          </div>

          {isClaimable && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink-900">
                  {isReassign ? "Reassign to" : "Assign to"}
                </h4>
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="text-xs text-brand-700 hover:underline"
                >
                  {pickerOpen ? "Hide" : "Show all"}
                </button>
              </div>
              {eligible.length === 0 ? (
                <p className="text-sm text-ink-500">
                  No active {shift.role}s available. Add one in Nurses, or change the shift's role.
                </p>
              ) : (
                <ul className={`space-y-1 ${pickerOpen ? "" : "max-h-64 overflow-y-auto"}`}>
                  {eligible.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => n.id && assign(n.id)}
                        disabled={busy === "assign" && pendingNurseId === n.id}
                        className="flex w-full items-center gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                          {initials(`${n.firstName} ${n.lastName}`)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink-900">
                            {n.firstName} {n.lastName}
                          </div>
                          <div className="text-xs text-ink-500">{n.role} · {n.phone}</div>
                        </div>
                        {busy === "assign" && pendingNurseId === n.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-ink-400" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {isCancellable && (
          <div className="flex shrink-0 items-center justify-between border-t border-ink-200 px-5 py-3">
            <span className="text-xs text-ink-500">
              {isReassign && "The current nurse will be notified."}
            </span>
            <button
              type="button"
              onClick={cancel}
              disabled={busy === "cancel"}
              className="btn-ghost text-rose-600 hover:bg-rose-50"
            >
              {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel shift
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
