"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Building2,
  ShieldCheck,
  Clock,
  Receipt,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shifts", label: "Shifts", icon: Calendar },
  { href: "/nurses", label: "Nurses", icon: Users },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/timekeeping", label: "Timekeeping", icon: Clock },
  { href: "/billing", label: "Billing", icon: Receipt },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-800/40 bg-ink-950 text-ink-200 md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-ink-800/60 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-soft">
          <Activity className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-white">QuickShift</span>
          <span className="text-[11px] text-ink-400">QuickCare Nursing Registry</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/5 text-white"
                  : "text-ink-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active ? "text-brand-400" : "text-ink-400 group-hover:text-ink-200",
                )}
              />
              {item.label}
            </Link>
          );
        })}
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
