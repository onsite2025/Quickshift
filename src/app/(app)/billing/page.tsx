"use client";

import { useEffect, useState } from "react";
import { doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { Plus, Receipt, Send } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { db } from "@/lib/firebase";
import { invoicesCol } from "@/lib/collections";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types";

const STATUS_COLOR: Record<Invoice["status"], string> = {
  draft: "bg-ink-100 text-ink-600 ring-ink-200",
  sent: "bg-blue-50 text-blue-700 ring-blue-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(invoicesCol, orderBy("issuedAt", "desc")));
        setInvoices(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invoice) })));
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  const updateStatus = async (inv: Invoice, status: Invoice["status"]) => {
    if (!inv.id) return;
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "paid") patch.paidAt = serverTimestamp();
      await updateDoc(doc(db, "invoices", inv.id), patch);
      setInvoices((rs) => rs.map((r) => (r.id === inv.id ? { ...r, status } : r)));
      toast.success(`Invoice ${inv.number} marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);

  return (
    <>
      <Header title="Billing" description="Invoices generated from completed shifts." />
      <main className="flex-1 p-6">
        <PageHeader
          title="Invoices"
          description={`Outstanding: ${formatCurrency(totalOutstanding)}`}
          actions={
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Generate invoice
            </button>
          }
        />

        {loading ? (
          <div className="card text-sm text-ink-500">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="Generate an invoice from completed shifts in a date range. Hours come from approved timesheets."
            action={
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Generate first invoice
              </button>
            }
          />
        ) : (
          <DataTable
            rows={invoices}
            columns={[
              {
                key: "number",
                header: "Invoice",
                render: (i) => <span className="font-mono text-xs text-ink-700">{i.number}</span>,
              },
              { key: "facilityName", header: "Facility" },
              {
                key: "period",
                header: "Period",
                render: (i) =>
                  `${format(i.periodStart.toDate(), "MMM d")} – ${format(i.periodEnd.toDate(), "MMM d")}`,
              },
              {
                key: "hours",
                header: "Hours",
                render: (i) =>
                  i.lineItems.reduce((s, l) => s + l.hours, 0).toFixed(2),
              },
              {
                key: "total",
                header: "Total",
                render: (i) => <span className="font-semibold">{formatCurrency(i.total)}</span>,
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
              {
                key: "actions",
                header: "",
                render: (i) =>
                  i.status === "draft" ? (
                    <button onClick={() => updateStatus(i, "sent")} className="btn-ghost text-xs">
                      <Send className="h-3.5 w-3.5" /> Send
                    </button>
                  ) : i.status === "sent" || i.status === "overdue" ? (
                    <button onClick={() => updateStatus(i, "paid")} className="btn-ghost text-xs">
                      Mark paid
                    </button>
                  ) : null,
              },
            ]}
          />
        )}
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="Generate invoice" description="Aggregates completed shifts and approved hours within the period.">
        <InvoiceForm onClose={() => setOpen(false)} onCreated={() => setTick((t) => t + 1)} />
      </Modal>
    </>
  );
}
