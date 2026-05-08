import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Facility, Shift } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const findFacilityByToken = async (token: string) => {
  if (!token) return null;
  const snap = await adminDb
    .collection("facilities")
    .where("portalToken", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...(doc.data() as Facility) };
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const facility = await findFacilityByToken(params.token);
  if (!facility) {
    return NextResponse.json({ error: "invalid link" }, { status: 404 });
  }

  const shiftsSnap = await adminDb
    .collection("shifts")
    .where("facilityId", "==", facility.id)
    .where("status", "in", [
      "draft",
      "open",
      "broadcasting",
      "confirmed",
      "in_progress",
    ])
    .orderBy("start", "asc")
    .get();

  const shifts = shiftsSnap.docs.map((d) => {
    const data = d.data() as Shift;
    return {
      id: d.id,
      date: data.date,
      shiftCode: data.shiftCode,
      shiftLabel: data.shiftLabel,
      role: data.role,
      status: data.status,
      start: data.start.toDate().toISOString(),
      end: data.end.toDate().toISOString(),
      nurseName: data.nurseName ?? null,
      nursePhone: data.nursePhone ?? null,
    };
  });

  return NextResponse.json({
    facility: {
      id: facility.id,
      name: facility.name,
      city: facility.city,
      state: facility.state,
      shiftTemplates: facility.shiftTemplates,
    },
    shifts,
  });
}
