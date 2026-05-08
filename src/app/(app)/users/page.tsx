"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { initials } from "@/lib/utils";
import type { AppUser, UserRole } from "@/types";

const ROLE_COLOR: Record<UserRole, string> = {
  operator: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  nurse: "bg-brand-50 text-brand-700 ring-brand-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AppUser) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = async (uid: string, role: UserRole) => {
    setBusyUid(uid);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/users/${uid}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Update failed");
        return;
      }
      toast.success(`Set to ${role}`);
      load();
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <>
      <Header title="Users" description="Approve new accounts and manage roles." />
      <main className="flex-1 p-6">
        <PageHeader
          title="Accounts"
          description="Anyone who signs up appears here as 'pending' until you promote them."
        />
        {loading ? (
          <div className="card text-sm text-ink-500">Loading…</div>
        ) : (
          <DataTable
            rows={users}
            columns={[
              {
                key: "email",
                header: "User",
                render: (u) => (
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">
                      {initials(u.email)}
                    </span>
                    <div>
                      <div className="font-medium text-ink-900">{u.email}</div>
                      <div className="font-mono text-xs text-ink-500">
                        {u.id?.slice(0, 12) ?? ""}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role",
                render: (u) => (
                  <span className={`badge ${ROLE_COLOR[u.role]}`}>{u.role}</span>
                ),
              },
              {
                key: "actions",
                header: "",
                render: (u) => {
                  const isMe = currentUser?.uid === u.id;
                  return (
                    <div className="flex items-center justify-end gap-2">
                      {busyUid === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                      ) : null}
                      {u.role !== "operator" && (
                        <button
                          onClick={() => u.id && setRole(u.id, "operator")}
                          disabled={busyUid === u.id}
                          className="btn-ghost text-xs"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Promote
                        </button>
                      )}
                      {u.role === "operator" && !isMe && (
                        <button
                          onClick={() => u.id && setRole(u.id, "pending")}
                          disabled={busyUid === u.id}
                          className="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
                        >
                          Demote
                        </button>
                      )}
                      {isMe && u.role === "operator" && (
                        <span className="text-xs text-ink-400">that's you</span>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </main>
    </>
  );
}
