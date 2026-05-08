"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { NavLinks } from "./NavLinks";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-800/40 bg-ink-950 text-ink-200 md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-ink-800/60 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-soft">
          <Activity className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <Link href="/dashboard" className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-white">QuickShift</span>
          <span className="text-[11px] text-ink-400">QuickCare Nursing Registry</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <NavLinks />
      </nav>

      <div className="border-t border-ink-800/60 p-4">
        <div className="rounded-lg bg-ink-900/70 p-3 text-xs text-ink-400">
          <p className="font-medium text-ink-200">Live dispatch</p>
          <p className="mt-1 leading-relaxed">
            Inbound SMS routed from Twilio. AI-parsed and broadcast to compliant clinicians.
          </p>
        </div>
      </div>
    </aside>
  );
}
