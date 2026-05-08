"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import { signOut } from "@/lib/auth";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-500">
        Loading…
      </div>
    );
  }
  if (!user) return null;

  // Signed-in but not yet promoted to an operator — show a pending screen
  // instead of an empty broken-permissions page.
  if (role !== "operator") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="card max-w-md text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
          <h1 className="mt-4 text-lg font-semibold text-ink-900">
            Account pending approval
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Your QuickShift account ({user.email}) hasn't been approved by an
            operator yet. Once an existing operator promotes your account, this
            page will load.
          </p>
          <button
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
            className="btn-secondary mt-5 w-full"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
