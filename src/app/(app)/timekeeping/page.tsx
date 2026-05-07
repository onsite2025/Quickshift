"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { timesheetsCol } from "@/lib/collections";
import type { Timesheet } from "@/types";

export default function TimekeepingPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(timesheetsCol, orderBy("clockIn", "desc")));
        setTimesheets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load timesheets");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header title="Timekeeping" />
      <main className="flex-1 p-6">
        <PageHeader
          title="Timekeeping"
          description="Clock-in/out records and approvals."
        />
        {error && (
          <div className="card mb-6 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>
        )}
        {loading ? (
          <div className="card text-sm text-slate-500">Loading timesheets…</div>
        ) : (
          <DataTable
            rows={timesheets}
            empty="No timesheets recorded yet."
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
                  t.clockOut ? format(t.clockOut.toDate(), "MMM d, h:mma") : "—",
              },
              {
                key: "totalHours",
                header: "Hours",
                render: (t) => (t.totalHours ? t.totalHours.toFixed(2) : "—"),
              },
              {
                key: "approved",
                header: "Approval",
                render: (t) => (
                  <span
                    className={`badge ${
                      t.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {t.approved ? "approved" : "pending"}
                  </span>
                ),
              },
            ]}
          />
        )}
      </main>
    </>
  );
}
