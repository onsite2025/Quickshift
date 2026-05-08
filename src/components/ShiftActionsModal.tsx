"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Loader2,
  Plus,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";
import {
  formatShiftDateLabel,
  formatShiftHour,
  initials,
  todayLocal,
} from "@/lib/utils";
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
  const [busy, setBusy] = useState<"" | "assign" | "cancel" | "duplicate">("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingNurseId, setPendingNurseId] = useState<string | null>(null);
  const [mode, setMode] = useState<"actions" | "duplicate">("actions");
  const [dupDates, setDupDates] = useState<string[]>([todayLocal()]);
  const [dupBroadcast, setDupBroadcast] = useState(true);

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
      toast.error("You're signed out — refresh the page and sign in again.");
      return;
    }
    setBusy("assign");
    setPendingNurseId(nurseId);
    try {
      const token = await auth.currentUser.getIdToken(true);
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

  const duplicate = async () => {
    const validDates = dupDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (validDates.length === 0) {
      toast.error("Pick at least one valid date.");
      return;
    }
    if (!auth.currentUser) {
      toast.error("You're signed out — refresh the page and sign in again.");
      return;
    }
    setBusy("duplicate");
    try {
      let token: string;
      try {
        token = await auth.currentUser.getIdToken(true);
      } catch (err) {
        toast.error(
          `Auth token error: ${err instanceof Error ? err.message : "unknown"}`,
        );
        return;
      }
      const res = await fetch(`/api/shifts/${shift.id}/duplicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dates: validDates, broadcast: dupBroadcast }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? `Duplicate failed (HTTP ${res.status})`);
        return;
      }
      const n = data.created?.length ?? 0;
      toast.success(
        dupBroadcast
          ? `Created ${n} shift${n === 1 ? "" : "s"} and broadcasted ${data.broadcastedCount}`
          : `Created ${n} draft shift${n === 1 ? "" : "s"}`,
      );
      onChanged();
      onClose();
    } finally {
      setBusy("");
    }
  };

  const cancel = async () => {
    if (!auth.currentUser) {
      toast.error("You're signed out — refresh the page and sign in again.");
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
      const token = await auth.currentUser.getIdToken(true);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-card sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-ink-200 px-5 py-4">
          <div className="flex min-w-0 items-start gap-2">
            {mode === "duplicate" && (
              <button
                type="button"
                onClick={() => setMode("actions")}
                className="rounded-md p-1 text-ink-500 hover:bg-ink-100"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-ink-900">
                {mode === "duplicate"
                  ? "Duplicate shift"
                  : `${shift.role} · ${shift.shiftCode}`}
              </h3>
              <p className="mt-0.5 truncate text-sm text-ink-500">
                {dateLabel} · {hours} · {shift.facilityName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "duplicate" ? (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-sm text-ink-600">
                Each new shift copies role, shift code, and hours from this one.
                Pick the dates and decide whether to broadcast right away.
              </p>
              <label className="label">Copy to date(s)</label>
              <div className="space-y-2">
                {dupDates.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="date"
                      className="input flex-1"
                      value={d}
                      onChange={(e) =>
                        setDupDates(
                          dupDates.map((x, idx) =>
                            idx === i ? e.target.value : x,
                          ),
                        )
                      }
                    />
                    {dupDates.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDupDates(dupDates.filter((_, idx) => idx !== i))
                        }
                        className="btn-ghost text-rose-600 hover:bg-rose-50"
                        aria-label="Remove date"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDupDates([...dupDates, todayLocal()])}
                className="mt-2 text-xs text-brand-700 hover:underline"
              >
                <Plus className="mr-1 inline h-3 w-3" /> Add another date
              </button>

              <label className="mt-5 flex items-start gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={dupBroadcast}
                  onChange={(e) => setDupBroadcast(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Broadcast each new shift to qualified clinicians right away.
                  <span className="block text-xs text-ink-500">
                    Uncheck to save them as drafts and broadcast later.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-ink-200 px-5 py-3">
              <span className="text-xs text-ink-500">
                {dupDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).length} date
                {dupDates.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={duplicate}
                disabled={busy === "duplicate"}
                className="btn-primary"
              >
                {busy === "duplicate" && <Loader2 className="h-4 w-4 animate-spin" />}
                {dupBroadcast ? "Duplicate & broadcast" : "Duplicate as draft"}
              </button>
            </div>
          </>
        ) : (
          <>
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

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-5 py-3">
          <button
            type="button"
            onClick={() => setMode("duplicate")}
            className="btn-ghost"
          >
            <Copy className="h-4 w-4" /> Duplicate to…
          </button>
          {isCancellable && (
            <button
              type="button"
              onClick={cancel}
              disabled={busy === "cancel"}
              className="btn-ghost text-rose-600 hover:bg-rose-50"
            >
              {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel shift
            </button>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
