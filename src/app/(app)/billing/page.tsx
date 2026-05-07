"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { invoicesCol } from "@/lib/collections";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types";

const STATUS_COLOR: Record<Invoice["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-rose-50 text-rose-700",
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(invoicesCol, orderBy("issuedAt", "desc")));
        setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load invoices");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header title="Billing" />
      <main className="flex-1 p-6">
        <PageHeader
          title="Billing"
          description="Invoices generated for facility clients."
          actions={
            <button className="btn-primary gap-2">
              <Plus className="h-4 w-4" /> New invoice
            </button>
          }
        />
        {error && (
          <div className="card mb-6 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>
        )}
        {loading ? (
          <div className="card text-sm text-slate-500">Loading invoices…</div>
        ) : (
          <DataTable
            rows={invoices}
            empty="No invoices issued yet."
            columns={[
              {
                key: "id",
                header: "Invoice",
                render: (i) => (
                  <span className="font-mono text-xs text-slate-500">
                    {i.id?.slice(0, 8) ?? ""}
                  </span>
                ),
              },
              { key: "facilityName", header: "Facility" },
              {
                key: "period",
                header: "Period",
                render: (i) =>
                  `${format(i.periodStart.toDate(), "MMM d")} – ${format(i.periodEnd.toDate(), "MMM d")}`,
              },
              {
                key: "total",
                header: "Total",
                render: (i) => formatCurrency(i.total),
              },
              {
                key: "dueAt",
                header: "Due",
                render: (i) => format(i.dueAt.toDate(), "MMM d, yyyy"),
              },
              {
                key: "status",
                header: "Status",
                render: (i) => (
                  <span className={`badge ${STATUS_COLOR[i.status]}`}>{i.status}</span>
                ),
              },
            ]}
          />
        )}
      </main>
    </>
  );
}
