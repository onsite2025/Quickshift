import Link from "next/link";
import { Activity } from "lucide-react";

export function PublicPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="font-semibold text-ink-900">QuickShift</span>
            <span className="text-xs text-ink-500">· QuickCare Nursing Registry</span>
          </Link>
          <Link href="/login" className="text-sm text-brand-700 hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: {lastUpdated}</p>
        <article className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink-900 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_strong]:text-ink-900 [&_a]:text-brand-700 [&_a]:underline">
          {children}
        </article>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4 text-xs text-ink-500">
          <span>© QuickCare Nursing Registry</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink-700">Privacy</Link>
            <Link href="/terms" className="hover:text-ink-700">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
