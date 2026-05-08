"use client";

import { useEffect, useState } from "react";
import { getDocs, orderBy, query, where } from "firebase/firestore";
import { Plus, Send } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ShiftGrid } from "@/components/ShiftGrid";
import { ShiftForm } from "@/components/forms/ShiftForm";
import { auth } from "@/lib/firebase";
import { nursesCol, shiftsCol } from "@/lib/collections";
import { formatShiftDateLabel, formatShiftHour } from "@/lib/utils";
import type { Nurse, Shift, ShiftStatus } from "@/types";

const STATUS_COLOR: Record<ShiftStatus, string> = {
  draft: "bg-ink-100 text-ink-700 ring-ink-200",
  broadcasting: "bg-amber-50 text-amber-700 ring-amber-200",
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  claimed: "bg-blue-50 text-blue-700 ring-blue-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  in_progress: "bg-brand-50 text-brand-700 ring-brand-200",
  completed: "bg-ink-50 text-ink-600 ring-ink-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showCancelled, setShowCancelled] = useState(false);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const visibleShifts = showCancelled
    ? shifts
    : shifts.filter((s) => s.status !== "cancelled");
  const cancelledCount = shifts.filter((s) => s.status === "cancelled").length;

  useEffect(() => {
    (async () => {
      const [shiftSnap, nurseSnap] = await Promise.all([
        getDocs(query(shiftsCol, orderBy("start", "asc"))),
        getDocs(query(nursesCol, where("status", "in", ["active", "on_leave"]), orderBy("lastName"))),
      ]);
      setShifts(shiftSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Shift) })));
      setNurses(nurseSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Nurse) })));
    })();
  }, [tick]);

  const broadcast = async (shift: Shift) => {
    if (!shift.id) return;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/shifts/${shift.id}/dispatch`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Sent to ${data.sent}`);
      setTick((t) => t + 1);
    } else {
      toast.error("Broadcast failed (check Twilio config)");
    }
  };

  return (
    <>
      <Header title="Shifts" description="Schedule, broadcast, and track every shift." />
      <main className="flex-1 p-6">
        <PageHeader
          title="Shifts"
          actions={
            <>
              {view === "list" && cancelledCount > 0 && (
                <button
                  onClick={() => setShowCancelled((v) => !v)}
                  className="btn-ghost text-xs"
                >
                  {showCancelled ? "Hide" : "Show"} cancelled ({cancelledCount})
                </button>
              )}
              <div className="flex rounded-lg border border-ink-200 bg-white p-0.5">
                {(["grid", "list"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setView(m)}
                    className={`rounded-md px-3 py-1 text-sm capitalize ${
                      view === m ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> New shift
              </button>
            </>
          }
        />

        {view === "grid" ? (
          <ShiftGrid nurses={nurses} shifts={shifts} />
        ) : (
          <DataTable
            rows={visibleShifts}
            columns={[
              {
                key: "date",
                header: "When",
                render: (s) => (
                  <div className="text-xs">
                    <div className="font-medium text-ink-900">
                      {formatShiftDateLabel(s.start.toDate())}
                    </div>
                    <div className="text-ink-500">
                      {formatShiftHour(s.start.toDate())}–{formatShiftHour(s.end.toDate())}
                    </div>
                  </div>
                ),
              },
              { key: "facilityName", header: "Facility" },
              {
                key: "shiftLabel",
                header: "Shift",
                render: (s) => (
                  <span className="badge bg-brand-50 text-brand-700 ring-brand-200">
                    {s.shiftCode} · {s.role}
                  </span>
                ),
              },
              {
                key: "nurseName",
                header: "Nurse",
                render: (s) => s.nurseName ?? <span className="text-ink-400">unassigned</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (s) => (
                  <span className={`badge ${STATUS_COLOR[s.status]}`}>
                    {s.status.replace("_", " ")}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                render: (s) =>
                  s.status === "draft" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        broadcast(s);
                      }}
                      className="btn-ghost text-xs"
                    >
                      <Send className="h-3.5 w-3.5" /> Broadcast
                    </button>
                  ) : null,
              },
            ]}
          />
        )}
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="New shift" description="The shift will be sent to qualified clinicians via SMS." size="lg">
        <ShiftForm onClose={() => setOpen(false)} onCreated={() => setTick((t) => t + 1)} />
      </Modal>
    </>
  );
}
