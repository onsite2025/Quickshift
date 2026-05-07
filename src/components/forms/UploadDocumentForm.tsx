"use client";

import { FormEvent, useEffect, useState } from "react";
import { addDoc, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { storage } from "@/lib/firebase";
import { documentsCol, nursesCol } from "@/lib/collections";
import type { ComplianceDocument, Nurse } from "@/types";

const TYPES: ComplianceDocument["type"][] = [
  "license",
  "certification",
  "background_check",
  "vaccination",
  "other",
];

export function UploadDocumentForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [form, setForm] = useState({
    nurseId: "",
    type: "license" as ComplianceDocument["type"],
    name: "",
    expiresAt: "",
    file: null as File | null,
  });

  useEffect(() => {
    (async () => {
      const snap = await getDocs(nursesCol);
      setNurses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Nurse) })));
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.file || !form.nurseId) {
      toast.error("Select a nurse and a file");
      return;
    }
    setBusy(true);
    try {
      const path = `documents/${form.nurseId}/${Date.now()}-${form.file.name}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, form.file);
      const url = await getDownloadURL(ref);

      const nurse = nurses.find((n) => n.id === form.nurseId);
      const expiresAt = form.expiresAt ? new Date(form.expiresAt) : null;
      const status: ComplianceDocument["status"] = expiresAt
        ? expiresAt.getTime() < Date.now()
          ? "expired"
          : (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30
            ? "expiring"
            : "valid"
        : "valid";

      await addDoc(documentsCol, {
        nurseId: form.nurseId,
        nurseName: nurse ? `${nurse.firstName} ${nurse.lastName}` : undefined,
        type: form.type,
        name: form.name || form.file.name,
        fileUrl: url,
        storagePath: path,
        status,
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : undefined,
        uploadedAt: serverTimestamp() as unknown as Timestamp,
      });

      toast.success("Document uploaded");
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Nurse</label>
        <select required className="input" value={form.nurseId} onChange={(e) => setForm({ ...form, nurseId: e.target.value })}>
          <option value="">Select…</option>
          {nurses.map((n) => (
            <option key={n.id} value={n.id}>{n.firstName} {n.lastName} — {n.role}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ComplianceDocument["type"] })}>
            {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Expires</label>
          <input type="date" className="input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Display name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. RN License – CA" />
      </div>
      <div>
        <label className="label">File</label>
        <input type="file" required className="block w-full text-sm" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Upload
        </button>
      </div>
    </form>
  );
}
