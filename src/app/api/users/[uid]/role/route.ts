import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserRole } from "@/types";

export const runtime = "nodejs";

const ALLOWED: UserRole[] = ["operator", "nurse", "pending"];

const requireOperator = async (req: NextRequest) => {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.role !== "operator") return null;
    return decoded;
  } catch {
    return null;
  }
};

export async function POST(
  req: NextRequest,
  { params }: { params: { uid: string } },
) {
  const me = await requireOperator(req);
  if (!me) return NextResponse.json({ error: "operator only" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const role = body?.role as UserRole;
  if (!ALLOWED.includes(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  // Don't let an operator demote themselves out of the last operator slot.
  if (me.uid === params.uid && role !== "operator") {
    const operatorsSnap = await adminDb
      .collection("users")
      .where("role", "==", "operator")
      .limit(2)
      .get();
    if (operatorsSnap.size <= 1) {
      return NextResponse.json(
        { error: "Can't demote yourself — you're the only operator." },
        { status: 400 },
      );
    }
  }

  await adminDb
    .collection("users")
    .doc(params.uid)
    .update({ role, updatedAt: Timestamp.now() });
  await adminAuth.setCustomUserClaims(params.uid, { role });

  return NextResponse.json({ ok: true });
}
