"use client";

import { useEffect, useState } from "react";
import { doc, getDocs, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { Clock, Download } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { auth, db } from "@/lib/firebase";
import { timesheetsCol } from "@/lib/collections";
import type { Timesheet } from "@/types";

export default function TimekeepingPage() {
  const [rows, setRows] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "pending" | "approved">("live");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(timesheetsCol, orderBy("clockIn", "desc")));
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Timesheet) })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = rows.filter((t) => {
    if (filter === "live") return !t.clockOut;
    if (filter === "pending") return t.clockOut && !t.approved;
    if (filter === "approved") return t.approved;
    return true;
  });

  const approve = async (t: Timesheet) => {
    if (!t.id) return;
    try {
      await updateDoc(doc(db, "timesheets", t.id), {
        approved: true,
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser?.uid ?? null,
      });
      setRows((rs) =>
        rs.map((r) => (r.id === t.id ? { ...r, approved: true, approvedAt: Timestamp.now() } : r)),
      );
      toast.success("Timesheet approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    }
  };

  const exportGusto = async () => {
    const start = new Date();
    start.setDate(start.getDate() - 14);
    const end = new Date();
    const token = await auth.currentUser?.getIdToken();
    const url = `/api/timesheets/export?start=${start.toISOString()}&end=${end.toISOString()}`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gusto-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  void where; // keep import for future server-side filtering

  return (
    <>
      <Header title="Timekeeping" description="SMS clock-in/out, approval, and Gusto export." />
      <main className="flex-1 p-6">
        <PageHeader
          title="Timesheets"
          actions={
            <>
              <div className="flex rounded-lg border border-ink-200 bg-white p-0.5">
                {(["live", "pending", "approved", "all"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilter(m)}
                    className={`rounded-md px-3 py-1 text-sm capitalize ${
                      filter === m ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button onClick={exportGusto} className="btn-secondary">
                <Download className="h-4 w-4" /> Gusto export
              </button>
            </>
          }
        />

        {loading ? (
          <div className="card text-sm text-ink-500">Loading timesheets…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nothing here"
            description="Nurses clock in and out by texting IN / OUT once their shift is confirmed."
          />
        ) : (
          <DataTable
            rows={filtered}
            columns={[
              { key: "nurseName", header: "Nurse" },
              { key: "facilityName", header: "Facility" },
              {
                key: "clockIn",
                header: "Clock in",
                render: (t) => format(t.clockIn.toDate(), "MMM d, h:mma"),
              },
              {
                key: "clockOut",
                header: "Clock out",
                render: (t) =>
                  t.clockOut ? (
                    format(t.clockOut.toDate(), "MMM d, h:mma")
                  ) : (
                    <span className="badge bg-amber-50 text-amber-700 ring-amber-200">live</span>
                  ),
              },
              {
                key: "totalHours",
                header: "Hours",
                render: (t) => (t.totalHours ? t.totalHours.toFixed(2) : "—"),
              },
              {
                key: "approved",
                header: "Status",
                render: (t) =>
                  t.approved ? (
                    <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">approved</span>
                  ) : t.clockOut ? (
                    <button onClick={() => approve(t)} className="btn-ghost text-xs">Approve</button>
                  ) : (
                    <span className="badge bg-ink-100 text-ink-600 ring-ink-200">in progress</span>
                  ),
              },
            ]}
          />
        )}
      </main>
    </>
  );
}
