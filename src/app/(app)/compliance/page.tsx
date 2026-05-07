"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { ShieldCheck, Upload } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { UploadDocumentForm } from "@/components/forms/UploadDocumentForm";
import { documentsCol } from "@/lib/collections";
import type { ComplianceDocument } from "@/types";

const STATUS_COLOR: Record<ComplianceDocument["status"], string> = {
  valid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expiring: "bg-amber-50 text-amber-700 ring-amber-200",
  expired: "bg-rose-50 text-rose-700 ring-rose-200",
  pending_review: "bg-ink-100 text-ink-600 ring-ink-200",
};

export default function CompliancePage() {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(documentsCol, orderBy("uploadedAt", "desc")));
        setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ComplianceDocument) })));
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  return (
    <>
      <Header title="Compliance" description="Documents, expirations, and auto-blocking." />
      <main className="flex-1 p-6">
        <PageHeader
          title="Documents"
          actions={
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Upload className="h-4 w-4" /> Upload
            </button>
          }
        />

        {loading ? (
          <div className="card text-sm text-ink-500">Loading documents…</div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No documents uploaded"
            description="Upload licenses, certifications, and vaccination records. Expiring docs will trigger nurse blocking automatically."
            action={
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Upload className="h-4 w-4" /> Upload first document
              </button>
            }
          />
        ) : (
          <DataTable
            rows={docs}
            columns={[
              { key: "nurseName", header: "Nurse" },
              { key: "name", header: "Document" },
              { key: "type", header: "Type" },
              {
                key: "expiresAt",
                header: "Expires",
                render: (d) => (d.expiresAt ? format(d.expiresAt.toDate(), "MMM d, yyyy") : "—"),
              },
              {
                key: "status",
                header: "Status",
                render: (d) => (
                  <span className={`badge ${STATUS_COLOR[d.status]}`}>
                    {d.status.replace("_", " ")}
                  </span>
                ),
              },
              {
                key: "fileUrl",
                header: "",
                render: (d) => (
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                    View
                  </a>
                ),
              },
            ]}
          />
        )}
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="Upload document" description="Stored in Firebase Storage. Expiration drives auto-blocking.">
        <UploadDocumentForm onClose={() => setOpen(false)} onCreated={() => setTick((t) => t + 1)} />
      </Modal>
    </>
  );
}
