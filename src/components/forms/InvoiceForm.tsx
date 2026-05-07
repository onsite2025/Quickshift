"use client";

import { FormEvent, useEffect, useState } from "react";
import { getDocs } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { facilitiesCol } from "@/lib/collections";
import type { Facility } from "@/types";

const today = new Date();
const twoWeeksAgo = new Date();
twoWeeksAgo.setDate(today.getDate() - 14);

export function InvoiceForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState({
    facilityId: "",
    periodStart: twoWeeksAgo.toISOString().slice(0, 10),
    periodEnd: today.toISOString().slice(0, 10),
    taxRate: "0",
    dueInDays: "14",
  });

  useEffect(() => {
    (async () => {
      const snap = await getDocs(facilitiesCol);
      setFacilities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Facility) })));
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const facility = facilities.find((f) => f.id === form.facilityId);
    if (!facility) return toast.error("Select a facility");
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          facilityId: facility.id,
          facilityName: facility.name,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          taxRate: Number(form.taxRate) / 100,
          dueInDays: Number(form.dueInDays),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Invoice generation failed");
      }
      const data = await res.json();
      toast.success(
        `Invoice ${data.invoice.number} created · ${data.invoice.lineItems.length} line items`,
      );
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invoice failed");
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Period start</label>
          <input type="date" required className="input" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
        </div>
        <div>
          <label className="label">Period end</label>
          <input type="date" required className="input" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Tax rate (%)</label>
          <input type="number" min="0" step="0.1" className="input" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
        </div>
        <div>
          <label className="label">Due in (days)</label>
          <input type="number" min="0" className="input" value={form.dueInDays} onChange={(e) => setForm({ ...form, dueInDays: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Generate
        </button>
      </div>
    </form>
  );
}
