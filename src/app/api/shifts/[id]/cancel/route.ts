import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { cancelShiftAsOperator, sendReassignmentNotice } from "@/lib/dispatch";
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await cancelShiftAsOperator(params.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.detail ?? result.reason ?? "Couldn't cancel" },
      { status: 400 },
    );
  }

  // If the shift had been confirmed with a nurse, give them a courtesy SMS.
  if (result.shift?.nurseId && result.shift.nursePhone) {
    void sendReassignmentNotice(result.shift, {
      phone: result.shift.nursePhone,
      name: result.shift.nurseName ?? "Nurse",
    });
  }

  void writeAudit({
    actorUid: user.uid,
    actorEmail: user.email ?? "",
    action: "shift.cancelled",
    targetType: "shift",
    targetId: params.id,
    targetName: result.shift
      ? `${result.shift.facilityName} • ${result.shift.role} ${result.shift.shiftCode}`
      : params.id,
    details: {
      hadNurse: Boolean(result.shift?.nurseId),
      nurseName: result.shift?.nurseName,
    },
  });

  return NextResponse.json({ ok: true });
}
