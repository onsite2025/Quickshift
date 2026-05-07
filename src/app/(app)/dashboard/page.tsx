"use client";

import { useEffect, useState } from "react";
import { getCountFromServer, query, where } from "firebase/firestore";
import { Calendar, Users, Building2, ShieldAlert } from "lucide-react";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import {
  nursesCol,
  facilitiesCol,
  shiftsCol,
  documentsCol,
} from "@/lib/collections";

interface Stats {
  nurses: number;
  facilities: number;
  openShifts: number;
  expiringDocs: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [nursesSnap, facilitiesSnap, openShiftsSnap, expiringDocsSnap] = await Promise.all([
          getCountFromServer(nursesCol),
          getCountFromServer(facilitiesCol),
          getCountFromServer(query(shiftsCol, where("status", "==", "open"))),
          getCountFromServer(query(documentsCol, where("status", "==", "expiring"))),
        ]);
        setStats({
          nurses: nursesSnap.data().count,
          facilities: facilitiesSnap.data().count,
          openShifts: openShiftsSnap.data().count,
          expiringDocs: expiringDocsSnap.data().count,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load stats");
      }
    })();
  }, []);

  const cards = [
    { label: "Nurses", value: stats?.nurses, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Facilities", value: stats?.facilities, icon: Building2, color: "text-emerald-600 bg-emerald-50" },
    { label: "Open shifts", value: stats?.openShifts, icon: Calendar, color: "text-amber-600 bg-amber-50" },
    { label: "Expiring documents", value: stats?.expiringDocs, icon: ShieldAlert, color: "text-rose-600 bg-rose-50" },
  ];

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 p-6">
        <PageHeader title="Overview" description="Snapshot of your registry today." />

        {error && (
          <div className="card mb-6 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="card">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{c.label}</span>
                  <span className={`rounded-md p-2 ${c.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 text-3xl font-bold text-slate-900">
                  {c.value ?? "—"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-3 font-semibold text-slate-900">Recent activity</h3>
            <p className="text-sm text-slate-500">
              Activity feed will appear here once shifts and timesheets begin flowing.
            </p>
          </div>
          <div className="card">
            <h3 className="mb-3 font-semibold text-slate-900">Quick links</h3>
            <ul className="space-y-2 text-sm text-brand-700">
              <li><a href="/shifts" className="hover:underline">Schedule a shift →</a></li>
              <li><a href="/nurses" className="hover:underline">Add a nurse →</a></li>
              <li><a href="/facilities" className="hover:underline">Add a facility →</a></li>
              <li><a href="/compliance" className="hover:underline">Review compliance documents →</a></li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
