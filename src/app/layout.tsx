import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "QuickShift — Nursing Registry by QuickCare",
  description:
    "AI-powered shift dispatch, compliance, timekeeping, and billing for nursing registries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              border: "1px solid rgb(221 226 235 / 0.7)",
              padding: "10px 14px",
              fontSize: "13px",
              color: "rgb(20 24 38)",
              boxShadow: "0 1px 3px rgb(15 23 42 / 0.08)",
              borderRadius: "10px",
            },
          }}
        />
      </body>
    </html>
  );
}
