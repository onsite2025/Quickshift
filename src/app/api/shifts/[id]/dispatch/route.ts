import { NextRequest, NextResponse } from "next/server";
import { broadcastShift } from "@/lib/dispatch";
import { adminAuth } from "@/lib/firebase-admin";
import { writeAudit } from "@/lib/audit";

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const nurseIds = Array.isArray(body?.nurseIds)
    ? body.nurseIds.filter((x: unknown): x is string => typeof x === "string")
    : undefined;

  try {
    const result = await broadcastShift(params.id, { nurseIds });
    void writeAudit({
      actorUid: user.uid,
      actorEmail: user.email ?? "",
      action: "shift.broadcast",
      targetType: "shift",
      targetId: params.id,
      details: {
        sentCount: result.sent,
        selective: Boolean(nurseIds?.length),
        targetCount: nurseIds?.length,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "broadcast failed" },
      { status: 500 },
    );
  }
}
