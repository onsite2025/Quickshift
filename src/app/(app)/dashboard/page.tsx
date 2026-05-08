"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { ShiftGrid } from "@/components/ShiftGrid";
import { auth, db } from "@/lib/firebase";
import { nursesCol, shiftsCol, documentsCol } from "@/lib/collections";
import type { Nurse, Shift } from "@/types";

interface Stats {
  activeNurses: number;
  openShifts: number;
  shiftsToday: number;
  expiringDocs: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [recent, setRecent] = useState<Shift[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const [activeNursesSnap, openShiftsSnap, shiftsTodaySnap, expiringSnap] = await Promise.all([
          getCountFromServer(query(nursesCol, where("status", "==", "active"))),
          getCountFromServer(
            query(shiftsCol, where("status", "in", ["open", "broadcasting"])),
          ),
          getCountFromServer(
            query(
              shiftsCol,
              where("start", ">=", Timestamp.fromDate(startOfDay)),
              where("start", "<=", Timestamp.fromDate(endOfDay)),
            ),
          ),
          getCountFromServer(query(documentsCol, where("status", "==", "expiring"))),
        ]);

        setStats({
          activeNurses: activeNursesSnap.data().count,
          openShifts: openShiftsSnap.data().count,
          shiftsToday: shiftsTodaySnap.data().count,
          expiringDocs: expiringSnap.data().count,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [nurseSnap, shiftSnap, recentSnap] = await Promise.all([
          getDocs(query(nursesCol, where("status", "in", ["active", "on_leave"]), orderBy("lastName"))),
          getDocs(query(shiftsCol, orderBy("start", "asc"), limit(200))),
          getDocs(query(collection(db, "shifts"), orderBy("updatedAt", "desc"), limit(8))),
        ]);
        setNurses(nurseSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Nurse) })));
        setShifts(shiftSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Shift) })));
        setRecent(recentSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Shift) })));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load shifts");
      }
    })();
  }, [tick]);

  const assign = async (shiftId: string, nurseId: string) => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/shifts/${shiftId}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ nurseId }),
    });
    if (res.ok) {
      toast.success("Shift assigned");
      setTick((t) => t + 1);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't assign");
    }
  };

  return (
    <>
      <Header
        title="Dashboard"
        description="Live operations across QuickCare Nursing Registry."
      />
      <main className="flex-1 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active clinicians"
            value={stats?.activeNurses}
            icon={Users}
            hint="Compliant and available"
          />
          <StatCard
            label="Open shifts"
            value={stats?.openShifts}
            icon={Calendar}
            hint="Broadcasting or awaiting YES"
          />
          <StatCard
            label="Shifts today"
            value={stats?.shiftsToday}
            icon={Activity}
            hint="All statuses"
          />
          <StatCard
            label="Expiring documents"
            value={stats?.expiringDocs}
            icon={ShieldAlert}
            hint="Within 30 days"
          />
        </div>

        <div className="mt-6">
          <ShiftGrid nurses={nurses} shifts={shifts} onAssign={assign} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900">Recent activity</h3>
              <span className="text-xs text-ink-500">last 8 events</span>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-ink-500">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <span className="rounded-md bg-ink-100 p-1.5 text-ink-600">
                      {s.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : s.status === "open" || s.status === "broadcasting" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Activity className="h-4 w-4 text-brand-600" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-800">
                        <span className="font-medium">{s.facilityName}</span> · {s.shiftLabel} ·{" "}
                        <span className="text-ink-500">{s.status.replace("_", " ")}</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        {format(s.updatedAt.toDate(), "MMM d, h:mm a")}
                      </p>
                    </div>
                    {s.nurseName && (
                      <span className="hidden truncate text-xs text-ink-500 sm:block">
                        {s.nurseName}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <h3 className="font-semibold text-ink-900">Dispatch tips</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li>• Facility texts <span className="kbd">need 1 CNA NOC tonight</span></li>
              <li>• AI parses → broadcasts to qualified nurses</li>
              <li>• First <span className="kbd">YES &lt;CODE&gt;</span> wins the shift</li>
              <li>• Reply <span className="kbd">IN</span> / <span className="kbd">OUT</span> for time tracking</li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
