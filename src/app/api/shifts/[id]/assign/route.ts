import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { assignShift, sendClaimConfirmations } from "@/lib/dispatch";

export const runtime = "nodejs";

const requireUser = async (req: NextRequest) => {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const nurseId = typeof body?.nurseId === "string" ? body.nurseId : null;
  if (!nurseId) {
    return NextResponse.json({ error: "nurseId required" }, { status: 400 });
  }

  const result = await assignShift(params.id, nurseId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.detail ?? result.reason ?? "Couldn't assign" },
      { status: 400 },
    );
  }

  // Fire-and-forget so the operator gets immediate UI feedback even if
  // Twilio is slow or rate-limited.
  if (result.shift) void sendClaimConfirmations(result.shift);

  return NextResponse.json({ ok: true });
}
