"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import { shiftsCol } from "@/lib/collections";
import type { Shift } from "@/types";

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(shiftsCol, orderBy("start", "asc")));
        setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load shifts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header title="Shifts" />
      <main className="flex-1 p-6">
        <PageHeader
          title="Shifts"
          description="Calendar view of scheduled, open, and completed shifts."
          actions={
            <button className="btn-primary gap-2">
              <Plus className="h-4 w-4" />
              New shift
            </button>
          }
        />
        {error && (
          <div className="card mb-6 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>
        )}
        {loading ? (
          <div className="card text-sm text-slate-500">Loading calendar…</div>
        ) : (
          <ShiftCalendar shifts={shifts} />
        )}
      </main>
    </>
  );
}
