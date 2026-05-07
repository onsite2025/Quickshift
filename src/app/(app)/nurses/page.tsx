"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { nursesCol } from "@/lib/collections";
import type { Nurse } from "@/types";

const STATUS_COLOR: Record<Nurse["status"], string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-slate-100 text-slate-600",
  on_leave: "bg-amber-50 text-amber-700",
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(nursesCol, orderBy("lastName")));
        setNurses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load nurses");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header title="Nurses" />
      <main className="flex-1 p-6">
        <PageHeader
          title="Nurses"
          description="Roster of registered clinicians."
          actions={
            <button className="btn-primary gap-2">
              <Plus className="h-4 w-4" /> Add nurse
            </button>
          }
        />
        {error && (
          <div className="card mb-6 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>
        )}
        {loading ? (
          <div className="card text-sm text-slate-500">Loading nurses…</div>
        ) : (
          <DataTable
            rows={nurses}
            empty="No nurses on the roster yet."
            columns={[
              {
                key: "name",
                header: "Name",
                render: (n) => `${n.firstName} ${n.lastName}`,
              },
              { key: "role", header: "Role" },
              { key: "email", header: "Email" },
              { key: "phone", header: "Phone" },
              {
                key: "status",
                header: "Status",
                render: (n) => (
                  <span className={`badge ${STATUS_COLOR[n.status]}`}>
                    {n.status.replace("_", " ")}
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
