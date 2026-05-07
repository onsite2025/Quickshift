"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { useAuth } from "./AuthProvider";
import { initials } from "@/lib/utils";

export function Header({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          {user && (
            <div className="flex items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-3 shadow-soft">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-white">
                {initials(user.email ?? "Q")}
              </span>
              <span className="hidden text-sm text-ink-700 sm:block">{user.email}</span>
            </div>
          )}
          <button onClick={handleSignOut} className="btn-ghost">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
