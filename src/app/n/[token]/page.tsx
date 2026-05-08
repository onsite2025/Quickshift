"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  LogIn,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatShiftDateLabel, formatShiftHour } from "@/lib/utils";
import type { NurseRole, NurseStatus, ShiftCode, ShiftStatus } from "@/types";

interface PortalNurse {
  id: string;
  firstName: string;
  lastName: string;
  role: NurseRole;
  status: NurseStatus;
  blockedReason: string | null;
}

interface PortalNurseShift {
  id: string;
  date: string;
  shiftCode: ShiftCode;
  shiftLabel: string;
  role: NurseRole;
  status: ShiftStatus;
  facilityName: string;
  start: string;
  end: string;
}

interface PortalDocument {
  id: string;
  type: string;
  name: string;
  status: "valid" | "expiring" | "expired" | "pending_review";
  expiresAt: string | null;
}

const SHIFT_STATUS_LABEL: Record<ShiftStatus, { text: string; cls: string }> = {
  draft: { text: "preparing", cls: "bg-ink-100 text-ink-700 ring-ink-200" },
  open: { text: "open", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  broadcasting: { text: "open", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  claimed: { text: "claimed", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  confirmed: { text: "confirmed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  in_progress: { text: "clocked in", cls: "bg-brand-50 text-brand-700 ring-brand-200" },
  completed: { text: "completed", cls: "bg-ink-50 text-ink-600 ring-ink-200" },
  cancelled: { text: "cancelled", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const DOC_STATUS_LABEL = {
  valid: { text: "valid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  expiring: { text: "expiring soon", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  expired: { text: "expired", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  pending_review: { text: "pending", cls: "bg-ink-100 text-ink-600 ring-ink-200" },
};

export default function NursePortalPage() {
  const { token } = useParams<{ token: string }>();
  const [nurse, setNurse] = useState<PortalNurse | null>(null);
  const [shifts, setShifts] = useState<PortalNurseShift[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clocking, setClocking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal-nurse/${token}/shifts`, { cache: "no-store" });
      if (!res.ok) {
        setError("This link isn't valid. Contact QuickCare for a new link.");
        return;
      }
      const json = await res.json();
      setNurse(json.nurse);
      setShifts(json.shifts);
      setDocuments(json.documents);
      setError(null);
    } catch {
      setError("Couldn't load your portal. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const clock = async (action: "in" | "out") => {
    setClocking(true);
    try {
      const res = await fetch(`/api/portal-nurse/${token}/clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't update timekeeping");
        return;
      }
      toast.success(action === "in" ? "Clocked in" : `Clocked out · ${data.hours?.toFixed(2) ?? "?"}h`);
      load();
    } finally {
      setClocking(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-semibold text-ink-900">Link invalid</h1>
          <p className="mt-2 text-sm text-ink-600">{error}</p>
        </div>
      </div>
    );
  }

  const upcoming = shifts.filter(
    (s) => s.status !== "completed" && s.status !== "cancelled",
  );
  const recent = shifts.filter(
    (s) => s.status === "completed" || s.status === "cancelled",
  );

  const inProgress = shifts.find((s) => s.status === "in_progress");
  const nextConfirmed = shifts.find((s) => s.status === "confirmed");

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div>
              <p className="text-base font-semibold text-ink-900">
                {nurse ? `${nurse.firstName} ${nurse.lastName}` : "QuickShift"}
              </p>
              {nurse && (
                <p className="text-xs text-ink-500">
                  {nurse.role} · QuickCare Nursing Registry
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {nurse?.status === "blocked" && (
          <div className="card border-rose-200 bg-rose-50/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
              <div>
                <p className="font-semibold text-rose-800">Account blocked</p>
                <p className="mt-1 text-sm text-rose-700">
                  {nurse.blockedReason ?? "Compliance issue — contact your coordinator."} You won't receive shift offers until this is resolved.
                </p>
              </div>
            </div>
          </div>
        )}

        {(inProgress || nextConfirmed) && (
          <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {inProgress ? "Currently working" : "Next shift"}
              </p>
              <p className="mt-1 font-semibold text-ink-900">
                {(inProgress ?? nextConfirmed)!.facilityName}
              </p>
              <p className="text-sm text-ink-600">
                {(inProgress ?? nextConfirmed)!.role} · {formatShiftDateLabel(new Date((inProgress ?? nextConfirmed)!.start))} ·{" "}
                {formatShiftHour(new Date((inProgress ?? nextConfirmed)!.start))}–
                {formatShiftHour(new Date((inProgress ?? nextConfirmed)!.end))}
              </p>
            </div>
            {inProgress ? (
              <button
                onClick={() => clock("out")}
                disabled={clocking}
                className="btn-primary"
              >
                <LogOut className="h-4 w-4" />
                Clock out
              </button>
            ) : (
              <button
                onClick={() => clock("in")}
                disabled={clocking}
                className="btn-primary"
              >
                <LogIn className="h-4 w-4" />
                Clock in
              </button>
            )}
          </div>
        )}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-600" />
            <h2 className="text-base font-semibold text-ink-900">
              Upcoming shifts
            </h2>
          </div>
          {loading ? (
            <div className="card text-sm text-ink-500">Loading…</div>
          ) : upcoming.length === 0 ? (
            <div className="card text-sm text-ink-500">
              No upcoming shifts. We'll text you when one opens up that matches your role.
            </div>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li key={s.id} className="card flex items-center gap-4 py-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {s.shiftCode}
                    </span>
                    <span className="text-base font-bold leading-none">
                      {s.role}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">
                      {formatShiftDateLabel(new Date(s.start))} ·{" "}
                      {formatShiftHour(new Date(s.start))}–{formatShiftHour(new Date(s.end))}
                    </p>
                    <p className="text-sm text-ink-600">{s.facilityName}</p>
                  </div>
                  <span className={`badge ${SHIFT_STATUS_LABEL[s.status].cls}`}>
                    {SHIFT_STATUS_LABEL[s.status].text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <h2 className="text-base font-semibold text-ink-900">Compliance</h2>
          </div>
          {documents.length === 0 ? (
            <div className="card text-sm text-ink-500">
              No documents on file. Your coordinator can upload your license, certifications, and vaccinations.
            </div>
          ) : (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id} className="card flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{d.name}</p>
                    <p className="text-xs text-ink-500">
                      {d.type.replace("_", " ")}
                      {d.expiresAt
                        ? ` · expires ${formatShiftDateLabel(new Date(d.expiresAt))}`
                        : ""}
                    </p>
                  </div>
                  <span className={`badge ${DOC_STATUS_LABEL[d.status].cls}`}>
                    {DOC_STATUS_LABEL[d.status].text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {recent.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-ink-500" />
              <h2 className="text-base font-semibold text-ink-900">Recent</h2>
            </div>
            <ul className="space-y-2">
              {recent.slice(0, 10).map((s) => (
                <li key={s.id} className="card flex items-center gap-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800">
                      {formatShiftDateLabel(new Date(s.start))} · {s.role} {s.shiftCode} · {s.facilityName}
                    </p>
                  </div>
                  <span className={`badge ${SHIFT_STATUS_LABEL[s.status].cls}`}>
                    {SHIFT_STATUS_LABEL[s.status].text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
