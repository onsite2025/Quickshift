"use client";

import { FormEvent, useState } from "react";
import { addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { nursesCol } from "@/lib/collections";
import { generatePortalToken } from "@/lib/utils";
import type { NurseRole, NurseStatus } from "@/types";

const ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];
const STATUSES: NurseStatus[] = ["active", "inactive", "on_leave"];

const normalizePhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
};

export function NurseForm({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "CNA" as NurseRole,
    licenseNumber: "",
    licenseState: "",
    licenseExpires: "",
    hourlyRate: "",
    status: "active" as NurseStatus,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const portalToken = generatePortalToken();
      const ref = await addDoc(nursesCol, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: normalizePhone(form.phone),
        role: form.role,
        licenseNumber: form.licenseNumber || undefined,
        licenseState: form.licenseState || undefined,
        licenseExpires: form.licenseExpires
          ? Timestamp.fromDate(new Date(form.licenseExpires))
          : undefined,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        status: form.status,
        portalToken,
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });
      toast.success("Nurse added");
      // Fire-and-forget: text the welcome link to the nurse's mobile.
      const idToken = await auth.currentUser?.getIdToken();
      fetch(`/api/nurse/${ref.id}/send-portal-link`, {
        method: "POST",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      })
        .then(async (res) => {
          if (res.ok) toast.success("Portal link sent to nurse's phone");
        })
        .catch(() => {});
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add nurse");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">First name</label>
          <input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <label className="label">Last name</label>
          <input required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Email</label>
          <input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Mobile phone</label>
          <input type="tel" required placeholder="555-555-5555" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as NurseRole })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Hourly rate</label>
          <input type="number" min="0" step="0.5" className="input" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as NurseStatus })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">License #</label>
          <input className="input" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
        </div>
        <div>
          <label className="label">State</label>
          <input maxLength={2} className="input uppercase" value={form.licenseState} onChange={(e) => setForm({ ...form, licenseState: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="label">Expires</label>
          <input type="date" className="input" value={form.licenseExpires} onChange={(e) => setForm({ ...form, licenseExpires: e.target.value })} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add nurse
        </button>
      </div>
    </form>
  );
}
