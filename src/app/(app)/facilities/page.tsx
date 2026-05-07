"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { Building2, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { FacilityForm } from "@/components/forms/FacilityForm";
import { facilitiesCol } from "@/lib/collections";
import type { Facility } from "@/types";

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(facilitiesCol, orderBy("name")));
        setFacilities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Facility) })));
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  return (
    <>
      <Header title="Facilities" description="Client locations that request shifts via SMS." />
      <main className="flex-1 p-6">
        <PageHeader
          title="Facility clients"
          actions={
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Add facility
            </button>
          }
        />

        {loading ? (
          <div className="card text-sm text-ink-500">Loading facilities…</div>
        ) : facilities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No facilities yet"
            description="Add a facility and assign their inbound SMS number. Configure AM/PM/NOC templates so the AI can map their requests."
            action={
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Add facility
              </button>
            }
          />
        ) : (
          <DataTable
            rows={facilities}
            columns={[
              { key: "name", header: "Facility" },
              {
                key: "city",
                header: "Location",
                render: (f) => `${f.city}, ${f.state}`,
              },
              { key: "contactName", header: "Contact" },
              { key: "inboundPhone", header: "Inbound SMS" },
              {
                key: "shiftTemplates",
                header: "Templates",
                render: (f) => (
                  <div className="flex flex-wrap gap-1">
                    {f.shiftTemplates?.map((t) => (
                      <span key={t.code} className="badge bg-brand-50 text-brand-700 ring-brand-200">
                        {t.code} {t.startTime}–{t.endTime}
                      </span>
                    )) ?? <span className="text-ink-400">none</span>}
                  </div>
                ),
              },
              {
                key: "active",
                header: "Status",
                render: (f) => (
                  <span
                    className={`badge ring-1 ring-inset ${
                      f.active
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-ink-100 text-ink-600 ring-ink-200"
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

      <Modal open={open} onClose={() => setOpen(false)} title="Add facility" description="Configure shift templates so AI dispatch knows their hours." size="lg">
        <FacilityForm onClose={() => setOpen(false)} onCreated={() => setTick((t) => t + 1)} />
      </Modal>
    </>
  );
}
