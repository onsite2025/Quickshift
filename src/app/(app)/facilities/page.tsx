"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { facilitiesCol } from "@/lib/collections";
import type { Facility } from "@/types";

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(facilitiesCol, orderBy("name")));
        setFacilities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load facilities");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header title="Facilities" />
      <main className="flex-1 p-6">
        <PageHeader
          title="Facilities"
          description="Client locations that request shifts."
          actions={
            <button className="btn-primary gap-2">
              <Plus className="h-4 w-4" /> Add facility
            </button>
          }
        />
        {error && (
          <div className="card mb-6 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>
        )}
        {loading ? (
          <div className="card text-sm text-slate-500">Loading facilities…</div>
        ) : (
          <DataTable
            rows={facilities}
            empty="No facilities yet."
            columns={[
              { key: "name", header: "Name" },
              {
                key: "city",
                header: "Location",
                render: (f) => `${f.city}, ${f.state}`,
              },
              { key: "contactName", header: "Contact" },
              { key: "contactPhone", header: "Phone" },
              {
                key: "active",
                header: "Status",
                render: (f) => (
                  <span
                    className={`badge ${
                      f.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {f.active ? "active" : "inactive"}
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
