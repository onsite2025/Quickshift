"use client";

import { FormEvent, useEffect, useState } from "react";
import { addDoc, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { facilitiesCol, shiftsCol } from "@/lib/collections";
import { buildShiftDate } from "@/lib/utils";
import type { Facility, NurseRole, ShiftCode } from "@/types";

const ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

export function ShiftForm({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState({
    facilityId: "",
    role: "CNA" as NurseRole,
    shiftCode: "AM" as ShiftCode,
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    (async () => {
      const snap = await getDocs(facilitiesCol);
      setFacilities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Facility) })));
    })();
  }, []);

  const facility = facilities.find((f) => f.id === form.facilityId);
  const template = facility?.shiftTemplates.find((t) => t.code === form.shiftCode);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!facility || !template) {
      toast.error("Select a facility with a matching shift template");
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

      const broadcast = window.confirm("Broadcast this shift to qualified nurses now?");
      if (broadcast) {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/shifts/${ref.id}/dispatch`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const data = await res.json();
          toast.success(`Broadcast sent to ${data.sent} clinician${data.sent === 1 ? "" : "s"}`);
        } else {
          toast.error("Broadcast failed (check Twilio config)");
        }
      } else {
        toast.success("Shift created");
      }
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create shift");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Facility</label>
        <select required className="input" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
          <option value="">Select…</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as NurseRole })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Shift</label>
          <select className="input" value={form.shiftCode} onChange={(e) => setForm({ ...form, shiftCode: e.target.value as ShiftCode })}>
            {(["AM", "PM", "NOC"] as ShiftCode[]).map((c) => (
              <option key={c} value={c}>
                {c}{facility?.shiftTemplates.find((t) => t.code === c)?.label ? ` — ${facility?.shiftTemplates.find((t) => t.code === c)?.label}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" required className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {template ? (
        <p className="text-xs text-ink-500">
          Template hours: {template.startTime} → {template.endTime}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={busy || !template} className="btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create &amp; broadcast
        </button>
      </div>
    </form>
  );
}
