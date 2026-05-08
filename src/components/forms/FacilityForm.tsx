"use client";

import { FormEvent, useState } from "react";
import { addDoc, doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { facilitiesCol } from "@/lib/collections";
import { generatePortalToken } from "@/lib/utils";
import type { Facility, ShiftTemplate } from "@/types";

const DEFAULT_TEMPLATES: ShiftTemplate[] = [
  { code: "AM", label: "AM (7a–3p)", startTime: "07:00", endTime: "15:00" },
  { code: "PM", label: "PM (3p–11p)", startTime: "15:00", endTime: "23:00" },
  { code: "NOC", label: "NOC (11p–7a)", startTime: "23:00", endTime: "07:00" },
];

const normalizePhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
};

export function FacilityForm({
  facility,
  onClose,
  onSaved,
}: {
  facility?: Facility;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const editing = Boolean(facility?.id);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: facility?.name ?? "",
    address: facility?.address ?? "",
    city: facility?.city ?? "",
    state: facility?.state ?? "",
    zip: facility?.zip ?? "",
    contactName: facility?.contactName ?? "",
    contactEmail: facility?.contactEmail ?? "",
    contactPhone: facility?.contactPhone ?? "",
    inboundPhone: facility?.inboundPhone ?? "",
    billingRate: facility?.billingRate?.toString() ?? "",
    active: facility?.active ?? true,
  });
  const [templates, setTemplates] = useState<ShiftTemplate[]>(
    facility?.shiftTemplates?.length ? facility.shiftTemplates : DEFAULT_TEMPLATES,
  );

  const updateTemplate = (i: number, patch: Partial<ShiftTemplate>) => {
    setTemplates(templates.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        address: form.address,
        city: form.city,
        state: form.state.toUpperCase(),
        zip: form.zip,
        contactName: form.contactName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone ? normalizePhone(form.contactPhone) : undefined,
        inboundPhone: form.inboundPhone ? normalizePhone(form.inboundPhone) : undefined,
        billingRate: form.billingRate ? Number(form.billingRate) : undefined,
        shiftTemplates: templates,
        active: form.active,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };
      if (editing && facility?.id) {
        await updateDoc(doc(db, "facilities", facility.id), payload);
        toast.success("Facility updated");
      } else {
        const portalToken = generatePortalToken();
        const ref = await addDoc(facilitiesCol, {
          ...payload,
          portalToken,
          createdAt: serverTimestamp() as unknown as Timestamp,
        });
        toast.success("Facility added");
        // Fire-and-forget: text the magic-link to the facility's contact phone.
        if (form.contactPhone) {
          const idToken = await auth.currentUser?.getIdToken();
          fetch(`/api/facility/${ref.id}/send-portal-link`, {
            method: "POST",
            headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
          })
            .then(async (res) => {
              if (res.ok) toast.success("Portal link sent to contact phone");
            })
            .catch(() => {});
        }
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Facility name</label>
        <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Address</label>
        <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">City</label>
          <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <label className="label">State</label>
          <input maxLength={2} className="input uppercase" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
        <div>
          <label className="label">ZIP</label>
          <input className="input" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Contact name</label>
          <input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
        </div>
        <div>
          <label className="label">Contact phone</label>
          <input className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Inbound SMS number (Twilio sees this)</label>
          <input className="input" placeholder="+15551234567" value={form.inboundPhone} onChange={(e) => setForm({ ...form, inboundPhone: e.target.value })} />
        </div>
        <div>
          <label className="label">Default billing rate ($/hr)</label>
          <input type="number" min="0" step="0.5" className="input" value={form.billingRate} onChange={(e) => setForm({ ...form, billingRate: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="label">Shift templates</label>
        <div className="space-y-2">
          {templates.map((t, i) => (
            <div key={t.code} className="grid grid-cols-12 gap-2 rounded-lg border border-ink-200 p-3">
              <div className="col-span-2">
                <span className="badge bg-brand-50 text-brand-700 ring-brand-200">{t.code}</span>
              </div>
              <input
                className="input col-span-4"
                placeholder="Label"
                value={t.label}
                onChange={(e) => updateTemplate(i, { label: e.target.value })}
              />
              <input
                type="time"
                className="input col-span-3"
                value={t.startTime}
                onChange={(e) => updateTemplate(i, { startTime: e.target.value })}
              />
              <input
                type="time"
                className="input col-span-3"
                value={t.endTime}
                onChange={(e) => updateTemplate(i, { endTime: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Active (uncheck to disable this facility)
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "Save changes" : "Add facility"}
        </button>
      </div>
    </form>
  );
}
