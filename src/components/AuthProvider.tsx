"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuth } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  role: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      // Read existing claim. If missing (first sign-in), call /api/auth/init
      // to mint one, then refresh the token to pick it up.
      try {
        const result = await u.getIdTokenResult();
        let r = result.claims.role as string | undefined;
        if (!r) {
          const idToken = await u.getIdToken();
          const res = await fetch("/api/auth/init", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            r = data.role;
            await u.getIdToken(true); // force refresh to read new claim
          }
        }
        setUser(u);
        setRole(r ?? null);
      } catch {
        setUser(u);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
