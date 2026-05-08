"use client";

import { useEffect, useState } from "react";
import { getDocs, limit, orderBy, query } from "firebase/firestore";
import { format } from "date-fns";
import {
  Activity,
  Ban,
  FileText,
  Link as LinkIcon,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  UserCog,
} from "lucide-react";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { auditLogsCol } from "@/lib/collections";
import type { AuditLogEntry } from "@/types";

const ACTION_LABEL: Record<string, string> = {
  "shift.assigned": "Assigned shift",
  "shift.reassigned": "Reassigned shift",
  "shift.cancelled": "Cancelled shift",
  "shift.broadcast": "Broadcast shift",
  "invoice.created": "Created invoice",
  "user.role_changed": "Changed user role",
  "facility.portal_link_sent": "Sent portal link",
  "facility.token_rotated": "Rotated portal token",
};

const ICON: Record<string, typeof Activity> = {
  "shift.assigned": UserCheck,
  "shift.reassigned": UserCheck,
  "shift.cancelled": Ban,
  "shift.broadcast": Send,
  "invoice.created": FileText,
  "user.role_changed": UserCog,
  "facility.portal_link_sent": LinkIcon,
  "facility.token_rotated": RefreshCw,
};

const ICON_COLOR: Record<string, string> = {
  "shift.assigned": "bg-emerald-50 text-emerald-700",
  "shift.reassigned": "bg-blue-50 text-blue-700",
  "shift.cancelled": "bg-rose-50 text-rose-700",
  "shift.broadcast": "bg-amber-50 text-amber-700",
  "invoice.created": "bg-brand-50 text-brand-700",
  "user.role_changed": "bg-ink-100 text-ink-700",
  "facility.portal_link_sent": "bg-brand-50 text-brand-700",
  "facility.token_rotated": "bg-rose-50 text-rose-700",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(auditLogsCol, orderBy("createdAt", "desc"), limit(200)),
        );
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditLogEntry) })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header
        title="Audit log"
        description="Operator actions across the registry."
      />
      <main className="flex-1 p-6">
        <PageHeader
          title="Activity"
          description="Last 200 operator actions. SMS conversations are logged separately under each facility."
        />

        {loading ? (
          <div className="card text-sm text-ink-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="card flex flex-col items-center py-10 text-center">
            <span className="rounded-full bg-brand-50 p-3 text-brand-600">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-semibold text-ink-900">Nothing yet</h3>
            <p className="mt-1 max-w-sm text-sm text-ink-500">
              As operators assign, cancel, broadcast, or change settings, every
              action will land here for accountability and dispute resolution.
            </p>
          </div>
        ) : (
          <div className="card-flush">
            <ul className="divide-y divide-ink-100">
              {entries.map((e) => {
                const Icon = ICON[e.action] ?? Activity;
                const colorCls = ICON_COLOR[e.action] ?? "bg-ink-100 text-ink-700";
                return (
                  <li key={e.id} className="flex items-start gap-3 p-4">
                    <span className={`mt-0.5 rounded-md p-1.5 ${colorCls}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-900">
                        <span className="font-medium">
                          {ACTION_LABEL[e.action] ?? e.action}
                        </span>
                        {e.target?.name && (
                          <>
                            {" "}
                            <span className="text-ink-500">·</span>{" "}
                            <span className="text-ink-700">{e.target.name}</span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        by {e.actor?.email ?? e.actor?.uid ?? "unknown"} ·{" "}
                        {format(e.createdAt.toDate(), "MMM d, yyyy h:mm:ss a")}
                      </p>
                      {e.details && Object.keys(e.details).length > 0 && (
                        <DetailLine details={e.details} action={e.action} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}

function DetailLine({
  details,
  action,
}: {
  details: Record<string, unknown>;
  action: string;
}) {
  // Friendly per-action summaries; everything else falls back to a compact
  // key:value list.
  if (action === "shift.assigned" || action === "shift.reassigned") {
    const nurseName = details.nurseName as string | undefined;
    const previousNurseName = details.previousNurseName as string | undefined;
    if (previousNurseName && nurseName) {
      return (
        <p className="mt-1 text-xs text-ink-600">
          {previousNurseName} → <span className="font-medium">{nurseName}</span>
        </p>
      );
    }
    if (nurseName) {
      return <p className="mt-1 text-xs text-ink-600">to {nurseName}</p>;
    }
  }
  if (action === "shift.broadcast") {
    return (
      <p className="mt-1 text-xs text-ink-600">
        Sent to {String(details.sentCount ?? 0)} clinicians
      </p>
    );
  }
  if (action === "invoice.created") {
    return (
      <p className="mt-1 text-xs text-ink-600">
        {String(details.facilityName ?? "")} ·{" "}
        {String(details.lineItemCount ?? 0)} line items
      </p>
    );
  }
  if (action === "user.role_changed") {
    return (
      <p className="mt-1 text-xs text-ink-600">
        {String(details.previousRole ?? "?")} →{" "}
        <span className="font-medium">{String(details.newRole ?? "?")}</span>
      </p>
    );
  }
  if (action === "facility.portal_link_sent") {
    return (
      <p className="mt-1 text-xs text-ink-600">
        sent to {String(details.sentTo ?? "")}
      </p>
    );
  }
  if (action === "shift.cancelled" && details.nurseName) {
    return (
      <p className="mt-1 text-xs text-ink-600">
        was assigned to {String(details.nurseName)}
      </p>
    );
  }
  return null;
}
