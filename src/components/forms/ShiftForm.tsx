"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { facilitiesCol, nursesCol, shiftsCol } from "@/lib/collections";
import { buildShiftDate, initials, todayLocal } from "@/lib/utils";
import type { Facility, Nurse, NurseRole, ShiftCode } from "@/types";

const ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

type Strategy = "all" | "specific" | "draft";

export function ShiftForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [eligibleNurses, setEligibleNurses] = useState<Nurse[]>([]);
  const [loadingNurses, setLoadingNurses] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<Strategy>("all");
  const [form, setForm] = useState({
    facilityId: "",
    role: "CNA" as NurseRole,
    shiftCode: "AM" as ShiftCode,
    date: todayLocal(),
    notes: "",
  });

  useEffect(() => {
    (async () => {
      const snap = await getDocs(facilitiesCol);
      setFacilities(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Facility) }))
          .filter((f) => f.active !== false),
      );
    })();
  }, []);

  // Re-fetch eligible nurses when role changes (or strategy switches to
  // specific). Reset selection whenever the role changes since the previous
  // selection no longer matches.
  useEffect(() => {
    if (strategy !== "specific") return;
    setLoadingNurses(true);
    setSelectedIds(new Set());
    (async () => {
      try {
        const snap = await getDocs(
          query(
            nursesCol,
            where("status", "==", "active"),
            where("role", "==", form.role),
          ),
        );
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Nurse) }))
          .filter((n) => n.phone)
          .sort((a, b) => a.lastName.localeCompare(b.lastName));
        setEligibleNurses(list);
      } finally {
        setLoadingNurses(false);
      }
    })();
  }, [form.role, strategy]);

  const facility = facilities.find((f) => f.id === form.facilityId);
  const template = facility?.shiftTemplates.find((t) => t.code === form.shiftCode);

  const toggleNurse = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    eligibleNurses.length > 0 && selectedIds.size === eligibleNurses.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(eligibleNurses.map((n) => n.id!).filter(Boolean)));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!facility || !template) {
      toast.error("Select a facility with a matching shift template");
      return;
    }
    if (strategy === "specific" && selectedIds.size === 0) {
      toast.error("Pick at least one nurse, or switch to All eligible / Save draft.");
      return;
    }
    setBusy(true);
    try {
      const start = buildShiftDate(form.date, template.startTime);
      let end = buildShiftDate(form.date, template.endTime);
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);

      const ref = await addDoc(shiftsCol, {
        facilityId: facility.id!,
        facilityName: facility.name,
        role: form.role,
        shiftCode: form.shiftCode,
        shiftLabel: template.label,
        date: form.date,
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
        status: "draft",
        hourlyRate: template.defaultRate ?? facility.billingRate ?? 0,
        notes: form.notes || undefined,
        broadcast: [],
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });

      if (strategy === "draft") {
        toast.success("Shift saved as draft");
        onCreated?.();
        onClose();
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      const body =
        strategy === "specific"
          ? { nurseIds: Array.from(selectedIds) }
          : {};
      const res = await fetch(`/api/shifts/${ref.id}/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Broadcast sent to ${data.sent} clinician${data.sent === 1 ? "" : "s"}`,
        );
      } else {
        toast.error("Broadcast failed (check Twilio config)");
      }
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create shift");
    } finally {
      setBusy(false);
    }
  };

  const submitLabel =
    strategy === "draft"
      ? "Save draft"
      : strategy === "specific"
        ? `Create & send to ${selectedIds.size}`
        : "Create & broadcast";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Facility</label>
        <select
          required
          className="input"
          value={form.facilityId}
          onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
        >
          <option value="">Select…</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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
            onChange={(e) =>
              setForm({ ...form, shiftCode: e.target.value as ShiftCode })
            }
          >
            {(["AM", "PM", "NOC"] as ShiftCode[]).map((c) => (
              <option key={c} value={c}>
                {c}
                {facility?.shiftTemplates.find((t) => t.code === c)?.label
                  ? ` — ${facility?.shiftTemplates.find((t) => t.code === c)?.label}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
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
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea
          className="input min-h-[80px]"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      {template ? (
        <p className="text-xs text-ink-500">
          Template hours: {template.startTime} → {template.endTime}
        </p>
      ) : null}

      <div>
        <label className="label">Send to</label>
        <div className="grid grid-cols-3 gap-2">
          {(["all", "specific", "draft"] as Strategy[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                strategy === s
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
              }`}
            >
              {s === "all" ? "All eligible" : s === "specific" ? "Pick specific" : "Save draft"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {strategy === "all" &&
            `Broadcasts to every active ${form.role} on the registry.`}
          {strategy === "specific" &&
            `Only the ${form.role}s you select get the SMS — useful for handing a shift to a preferred nurse.`}
          {strategy === "draft" &&
            "Creates the shift but doesn't send any SMS. Broadcast later from the shift list."}
        </p>
      </div>

      {strategy === "specific" && (
        <div className="rounded-lg border border-ink-200 bg-ink-50/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Eligible {form.role}s ({eligibleNurses.length})
            </p>
            {eligibleNurses.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-brand-700 hover:underline"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>
          {loadingNurses ? (
            <p className="py-2 text-sm text-ink-500">Loading…</p>
          ) : eligibleNurses.length === 0 ? (
            <p className="py-2 text-sm text-ink-500">
              No active {form.role}s on the registry.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {eligibleNurses.map((n) => {
                const checked = n.id ? selectedIds.has(n.id) : false;
                return (
                  <li key={n.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-2 py-1.5 text-sm transition ${
                        checked
                          ? "border-brand-300 bg-white"
                          : "border-transparent hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => n.id && toggleNurse(n.id)}
                      />
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700">
                        {initials(`${n.firstName} ${n.lastName}`)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {n.firstName} {n.lastName}
                      </span>
                      <span className="text-xs text-ink-500">{n.phone}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={busy || !template} className="btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
        </button>
      </div>
    </form>
  );
}
