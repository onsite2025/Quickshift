import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { broadcastShift, createShiftFromRequest } from "@/lib/dispatch";
import type { Facility, NurseRole, ShiftCode } from "@/types";

export const runtime = "nodejs";

const VALID_CODES: ShiftCode[] = ["AM", "PM", "NOC"];
const VALID_ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const facSnap = await adminDb
    .collection("facilities")
    .where("portalToken", "==", params.token)
    .limit(1)
    .get();
  if (facSnap.empty) {
    return NextResponse.json({ error: "invalid link" }, { status: 404 });
  }
  const doc = facSnap.docs[0]!;
  const facility: Facility = { id: doc.id, ...(doc.data() as Facility) };
  if (facility.active === false) {
    return NextResponse.json(
      { error: "This facility is inactive. Contact QuickCare to reactivate." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const date = String(body.date ?? "");
  const shiftCode = body.shiftCode as ShiftCode;
  const role = body.role as NurseRole;
  const count = Math.min(20, Math.max(1, Number(body.count) || 1));
  const notes =
    typeof body.notes === "string" && body.notes.length > 0 ? body.notes : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (!VALID_CODES.includes(shiftCode)) {
    return NextResponse.json({ error: "invalid shiftCode" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  if (!facility.shiftTemplates?.find((t) => t.code === shiftCode)) {
    return NextResponse.json(
      { error: `${shiftCode} not configured for this facility` },
      { status: 400 },
    );
  }

  let createdCount = 0;
  for (let i = 0; i < count; i++) {
    try {
      const { id } = await createShiftFromRequest(
        facility,
        { date, shiftCode, role, count: 1, notes },
        "via portal",
      );
      await broadcastShift(id);
      createdCount++;
    } catch (err) {
      console.error("portal request: create/broadcast failed", err);
    }
  }

  return NextResponse.json({ ok: true, count: createdCount });
}
