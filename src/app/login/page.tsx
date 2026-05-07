"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { signIn, signUp } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 p-6 text-ink-200">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,98,244,0.25),transparent_45%),radial-gradient(circle_at_75%_85%,rgba(31,45,168,0.4),transparent_55%)]" />
      <div className="relative z-10 grid w-full max-w-5xl gap-10 lg:grid-cols-2">
        <div className="hidden flex-col justify-between lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
              <Activity className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-base font-semibold text-white">QuickShift</p>
              <p className="text-xs text-ink-400">QuickCare Nursing Registry</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              Fill shifts in minutes,<br />not hours.
            </h2>
            <p className="mt-3 max-w-md text-sm text-ink-300">
              Facilities text in. AI parses the request. The right nurses get a blast — first YES wins.
              Compliance, timekeeping, and billing follow automatically.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-ink-300">
              <li>• AI-powered SMS dispatch</li>
              <li>• Auto-blocking of expired credentials</li>
              <li>• SMS clock-in / clock-out → Gusto export</li>
              <li>• One-click invoices after each pay period</li>
            </ul>
          </div>

          <p className="text-xs text-ink-500">© QuickCare Nursing Registry</p>
        </div>

        <div className="rounded-2xl border border-ink-800/40 bg-ink-900/60 p-8 shadow-card backdrop-blur">
          <h1 className="text-xl font-semibold text-white">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {mode === "signin"
              ? "Sign in to manage your registry."
              : "Start dispatching shifts in minutes."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label text-ink-300">Email</label>
              <input
                type="email"
                required
                className="input bg-ink-950/60 border-ink-800/80 text-white placeholder:text-ink-500 focus:border-brand-400 focus:ring-brand-500/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@quickcare.com"
              />
            </div>
            <div>
              <label className="label text-ink-300">Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input bg-ink-950/60 border-ink-800/80 text-white placeholder:text-ink-500 focus:border-brand-400 focus:ring-brand-500/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 w-full text-sm text-brand-300 hover:text-brand-200"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
