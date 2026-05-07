"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { Plus, Users } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { NurseForm } from "@/components/forms/NurseForm";
import { nursesCol } from "@/lib/collections";
import { initials } from "@/lib/utils";
import type { Nurse } from "@/types";

const STATUS_COLOR: Record<Nurse["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive: "bg-ink-100 text-ink-600 ring-ink-200",
  on_leave: "bg-amber-50 text-amber-700 ring-amber-200",
  blocked: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(nursesCol, orderBy("lastName")));
        setNurses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Nurse) })));
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  return (
    <>
      <Header title="Nurses" description="Roster of registered clinicians." />
      <main className="flex-1 p-6">
        <PageHeader
          title="Clinicians"
          actions={
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Add nurse
            </button>
          }
        />

        {loading ? (
          <div className="card text-sm text-ink-500">Loading roster…</div>
        ) : nurses.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clinicians yet"
            description="Add nurses to start dispatching shifts. They'll receive SMS broadcasts when you create matching shifts."
            action={
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Add your first nurse
              </button>
            }
          />
        ) : (
          <DataTable
            rows={nurses}
            columns={[
              {
                key: "name",
                header: "Clinician",
                render: (n) => (
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                      {initials(`${n.firstName} ${n.lastName}`)}
                    </span>
                    <div>
                      <div className="font-medium text-ink-900">{n.firstName} {n.lastName}</div>
                      <div className="text-xs text-ink-500">{n.email}</div>
                    </div>
                  </div>
                ),
              },
              { key: "role", header: "Role" },
              { key: "phone", header: "Phone" },
              {
                key: "license",
                header: "License",
                render: (n) =>
                  n.licenseNumber ? (
                    <div className="text-xs">
                      <div>{n.licenseState} · {n.licenseNumber}</div>
                      {n.licenseExpires && (
                        <div className="text-ink-500">
                          exp {format(n.licenseExpires.toDate(), "MMM yyyy")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-ink-400">—</span>
                  ),
              },
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

      <Modal open={open} onClose={() => setOpen(false)} title="Add nurse" description="Create a new clinician record." size="lg">
        <NurseForm onClose={() => setOpen(false)} onCreated={() => setTick((t) => t + 1)} />
      </Modal>
    </>
  );
}
