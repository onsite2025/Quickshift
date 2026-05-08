"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, LogOut, Menu, X } from "lucide-react";
import { signOut } from "@/lib/auth";
import { useAuth } from "./AuthProvider";
import { NavLinks } from "./NavLinks";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-ink-700 hover:bg-ink-100"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Activity className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="font-semibold text-ink-900">QuickShift</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="rounded-md p-2 text-ink-700 hover:bg-ink-100"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-ink-900/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-ink-950 text-ink-200 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-ink-800/60 px-4">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-soft">
                  <Activity className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight text-white">
                    QuickShift
                  </span>
                  <span className="text-[11px] text-ink-400">QuickCare Nursing Registry</span>
                </div>
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-ink-300 hover:bg-white/5 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>

            <div className="border-t border-ink-800/60 p-4">
              {user && (
                <p className="truncate text-xs text-ink-400">{user.email}</p>
              )}
              <button
                onClick={handleSignOut}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 px-3 py-2 text-sm text-ink-200 hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
