import { Sidebar } from "@/components/Sidebar";
import { RequireAuth } from "@/components/RequireAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-ink-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </RequireAuth>
  );
}
