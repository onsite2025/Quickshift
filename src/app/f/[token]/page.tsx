"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatShiftDateLabel, formatShiftHour } from "@/lib/utils";
import type { NurseRole, ShiftCode, ShiftStatus, ShiftTemplate } from "@/types";

interface PortalShift {
  id: string;
  date: string;
  shiftCode: ShiftCode;
  shiftLabel: string;
  role: NurseRole;
  status: ShiftStatus;
  start: string;
  end: string;
  nurseName: string | null;
  nursePhone: string | null;
}

interface PortalFacility {
  id: string;
  name: string;
  city: string;
  state: string;
  shiftTemplates: ShiftTemplate[];
}

const STATUS_LABEL: Record<ShiftStatus, { text: string; cls: string }> = {
  draft: { text: "preparing", cls: "bg-ink-100 text-ink-700 ring-ink-200" },
  open: { text: "looking for nurse", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  broadcasting: { text: "looking for nurse", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  claimed: { text: "claimed", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  confirmed: { text: "confirmed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  in_progress: { text: "in progress", cls: "bg-brand-50 text-brand-700 ring-brand-200" },
  completed: { text: "completed", cls: "bg-ink-50 text-ink-600 ring-ink-200" },
  cancelled: { text: "cancelled", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [facility, setFacility] = useState<PortalFacility | null>(null);
  const [shifts, setShifts] = useState<PortalShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/${token}/shifts`, { cache: "no-store" });
      if (!res.ok) {
        setError("This link isn't valid. Contact QuickCare for a new link.");
        return;
      }
      const json = await res.json();
      setFacility(json.facility);
      setShifts(json.shifts);
      setError(null);
    } catch {
      setError("Couldn't load your portal. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onCancel = async (shift: PortalShift) => {
    if (
      !window.confirm(
        `Cancel ${shift.role} ${shift.shiftLabel} on ${formatShiftDateLabel(new Date(shift.start))}?`,
      )
    )
      return;
    const res = await fetch(`/api/portal/${token}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't cancel that shift");
      return;
    }
    toast.success("Shift cancelled");
    load();
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-semibold text-ink-900">Link invalid</h1>
          <p className="mt-2 text-sm text-ink-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div>
              <p className="text-base font-semibold text-ink-900">{facility?.name ?? "QuickShift"}</p>
              {facility && (
                <p className="text-xs text-ink-500">
                  {facility.city}, {facility.state} · QuickCare Nursing Registry
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">Your shifts</h2>
            <p className="text-sm text-ink-500">Open requests, confirmed shifts, and active assignments.</p>
          </div>
          <button onClick={() => setShowRequest(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Request shift
          </button>
        </div>

        {loading ? (
          <div className="card text-sm text-ink-500">Loading…</div>
        ) : shifts.length === 0 ? (
          <div className="card flex flex-col items-center py-10 text-center">
            <span className="rounded-full bg-brand-50 p-3 text-brand-600">
              <Calendar className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-semibold text-ink-900">No active shifts</h3>
            <p className="mt-1 max-w-sm text-sm text-ink-500">
              Tap "Request shift" to send a staffing request to QuickCare's nurses.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {shifts.map((s) => (
              <ShiftRow key={s.id} shift={s} onCancel={() => onCancel(s)} />
            ))}
          </ul>
        )}
      </main>

      {showRequest && facility && (
        <RequestShiftModal
          facility={facility}
          token={token as string}
          onClose={() => setShowRequest(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

function ShiftRow({
  shift,
  onCancel,
}: {
  shift: PortalShift;
  onCancel: () => void;
}) {
  const status = STATUS_LABEL[shift.status];
  const dateLabel = formatShiftDateLabel(new Date(shift.start));
  const hours = `${formatShiftHour(new Date(shift.start))}–${formatShiftHour(new Date(shift.end))}`;
  const cancellable = ["draft", "open", "broadcasting"].includes(shift.status);

  return (
    <li className="card flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <span className="text-[10px] font-semibold uppercase tracking-wider">{shift.shiftCode}</span>
        <span className="text-base font-bold leading-none">{shift.role}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink-900">{dateLabel}</span>
          <span className="text-sm text-ink-500">· {hours}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className={`badge ${status.cls}`}>{status.text}</span>
          {shift.nurseName && (
            <span className="text-ink-500">
              {shift.status === "in_progress" ? (
                <CheckCircle2 className="inline h-3 w-3 text-emerald-600" />
              ) : (
                <Clock className="inline h-3 w-3" />
              )}{" "}
              {shift.nurseName}
              {shift.nursePhone ? ` · ${shift.nursePhone}` : ""}
            </span>
          )}
        </div>
      </div>
      {cancellable ? (
        <button onClick={onCancel} className="btn-ghost text-rose-600 hover:bg-rose-50">
          <X className="h-4 w-4" /> Cancel
        </button>
      ) : null}
    </li>
  );
}

function RequestShiftModal({
  facility,
  token,
  onClose,
  onCreated,
}: {
  facility: PortalFacility;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    role: "CNA" as NurseRole,
    shiftCode: "AM" as ShiftCode,
    date: today,
    count: "1",
    notes: "",
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/${token}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: form.role,
          shiftCode: form.shiftCode,
          date: form.date,
          count: Number(form.count) || 1,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't submit");
        return;
      }
      const data = await res.json();
      toast.success(
        `Request sent — looking for ${data.count} ${form.role}${data.count === 1 ? "" : "s"}`,
      );
      onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-card">
        <div className="flex items-start justify-between border-b border-ink-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-ink-900">Request a shift</h3>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as NurseRole })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Shift</label>
              <select
                className="input"
                value={form.shiftCode}
                onChange={(e) => setForm({ ...form, shiftCode: e.target.value as ShiftCode })}
              >
                {facility.shiftTemplates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                required
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">How many?</label>
              <input
                type="number"
                min={1}
                max={20}
                className="input"
                value={form.count}
                onChange={(e) => setForm({ ...form, count: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[60px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
