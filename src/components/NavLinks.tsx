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
  UserCog,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shifts", label: "Shifts", icon: Calendar },
  { href: "/nurses", label: "Nurses", icon: Users },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/timekeeping", label: "Timekeeping", icon: Clock },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/users", label: "Users", icon: UserCog },
  { href: "/audit", label: "Audit log", icon: History },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
    </>
  );
}
