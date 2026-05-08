import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import {
  assignShift,
  sendClaimConfirmations,
  sendReassignmentNotice,
} from "@/lib/dispatch";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const requireUser = async (req: NextRequest) => {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    console.warn("[assign] no Bearer token on request");
    return null;
  }
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (err) {
    console.error(
      "[assign] verifyIdToken failed:",
      err instanceof Error ? err.message : err,
    );
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
  if (result.shift) {
    void sendClaimConfirmations(result.shift);
    if (result.previousNurse) {
      void sendReassignmentNotice(result.shift, result.previousNurse);
    }
    void writeAudit({
      actorUid: user.uid,
      actorEmail: user.email ?? "",
      action: result.previousNurse ? "shift.reassigned" : "shift.assigned",
      targetType: "shift",
      targetId: params.id,
      targetName: `${result.shift.facilityName} • ${result.shift.role} ${result.shift.shiftCode}`,
      details: {
        nurseId: result.shift.nurseId,
        nurseName: result.shift.nurseName,
        previousNurseId: result.previousNurse?.id,
        previousNurseName: result.previousNurse?.name,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    reassigned: Boolean(result.previousNurse),
  });
}
