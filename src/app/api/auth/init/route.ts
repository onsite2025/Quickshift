import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AppUser, UserRole } from "@/types";

export const runtime = "nodejs";

// Called once per signed-in user from the AuthProvider. Looks up (or creates)
// their users/{uid} doc, mints a custom claim with their role, and returns it.
// First-ever user becomes operator automatically; later signups are pending
// until promoted by an existing operator.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const uid = decoded.uid;
  const email = decoded.email ?? "";
  const userRef = adminDb.collection("users").doc(uid);
  const snap = await userRef.get();

  let role: UserRole;
  if (snap.exists) {
    role = (snap.data() as AppUser).role;
  } else {
    // First-user bootstrap: if no operators exist yet, promote this user.
    const operatorsSnap = await adminDb
      .collection("users")
      .where("role", "==", "operator")
      .limit(1)
      .get();
    role = operatorsSnap.empty ? "operator" : "pending";

    const now = Timestamp.now();
    await userRef.set({
      email,
      role,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Set the role on the JWT so Firestore rules can read it as
  // request.auth.token.role without an extra Firestore lookup per request.
  await adminAuth.setCustomUserClaims(uid, { role });

  return NextResponse.json({ role });
}
