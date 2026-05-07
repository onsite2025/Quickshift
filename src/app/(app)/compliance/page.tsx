"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { Upload } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { documentsCol } from "@/lib/collections";
import type { ComplianceDocument } from "@/types";

const STATUS_COLOR: Record<ComplianceDocument["status"], string> = {
  valid: "bg-emerald-50 text-emerald-700",
  expiring: "bg-amber-50 text-amber-700",
  expired: "bg-rose-50 text-rose-700",
  pending_review: "bg-slate-100 text-slate-600",
};

export default function CompliancePage() {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(documentsCol, orderBy("uploadedAt", "desc")));
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load documents");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header title="Compliance" />
      <main className="flex-1 p-6">
        <PageHeader
          title="Compliance"
          description="Licenses, certifications, and other clinician documents."
          actions={
            <button className="btn-primary gap-2">
              <Upload className="h-4 w-4" /> Upload document
            </button>
          }
        />
        {error && (
          <div className="card mb-6 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>
        )}
        {loading ? (
          <div className="card text-sm text-slate-500">Loading documents…</div>
        ) : (
          <DataTable
            rows={docs}
            empty="No documents uploaded yet."
            columns={[
              { key: "name", header: "Document" },
              { key: "type", header: "Type" },
              {
                key: "expiresAt",
                header: "Expires",
                render: (d) =>
                  d.expiresAt ? format(d.expiresAt.toDate(), "MMM d, yyyy") : "—",
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
                header: "File",
                render: (d) => (
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    View
                  </a>
                ),
              },
            ]}
          />
        )}
      </main>
    </>
  );
}
