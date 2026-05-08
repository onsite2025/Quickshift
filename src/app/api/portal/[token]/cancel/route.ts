import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { cancelSpecificShifts } from "@/lib/dispatch";
import { enforcePortalRateLimit } from "@/lib/rate-limit";
import type { Facility } from "@/types";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const limited = await enforcePortalRateLimit(req, {
    token: params.token,
    endpoint: "facility-cancel",
    limit: 20,
  });
  if (limited) return limited;

  const facSnap = await adminDb
    .collection("facilities")
    .where("portalToken", "==", params.token)
    .limit(1)
    .get();
  if (facSnap.empty) {
    return NextResponse.json({ error: "invalid link" }, { status: 404 });
  }
  const doc = facSnap.docs[0]!;
  const facility = { id: doc.id, ...(doc.data() as Facility) };

  const body = await req.json().catch(() => null);
  const shiftId = typeof body?.shiftId === "string" ? body.shiftId : null;
  if (!shiftId) {
    return NextResponse.json({ error: "shiftId required" }, { status: 400 });
  }

  const result = await cancelSpecificShifts(facility.id, [shiftId]);
  if (result.count === 0) {
    return NextResponse.json(
      {
        error:
          "Shift can't be cancelled here — it may already be claimed by a nurse. Contact your coordinator.",
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, count: result.count });
}
