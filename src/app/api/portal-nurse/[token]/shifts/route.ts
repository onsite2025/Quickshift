import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { enforcePortalRateLimit } from "@/lib/rate-limit";
import type { ComplianceDocument, Nurse, Shift } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const findNurseByToken = async (token: string) => {
  if (!token) return null;
  const snap = await adminDb
    .collection("nurses")
    .where("portalToken", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...(doc.data() as Nurse) };
};

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const limited = await enforcePortalRateLimit(req, {
    token: params.token,
    endpoint: "nurse-shifts",
    limit: 60,
  });
  if (limited) return limited;

  const nurse = await findNurseByToken(params.token);
  if (!nurse) {
    return NextResponse.json({ error: "invalid link" }, { status: 404 });
  }

  const since = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [shiftsSnap, docsSnap] = await Promise.all([
    adminDb
      .collection("shifts")
      .where("nurseId", "==", nurse.id)
      .where("start", ">=", since)
      .orderBy("start", "asc")
      .get(),
    adminDb
      .collection("documents")
      .where("nurseId", "==", nurse.id)
      .orderBy("uploadedAt", "desc")
      .get(),
  ]);

  const shifts = shiftsSnap.docs.map((d) => {
    const data = d.data() as Shift;
    return {
      id: d.id,
      date: data.date,
      shiftCode: data.shiftCode,
      shiftLabel: data.shiftLabel,
      role: data.role,
      status: data.status,
      facilityName: data.facilityName,
      start: data.start.toDate().toISOString(),
      end: data.end.toDate().toISOString(),
    };
  });

  const documents = docsSnap.docs.map((d) => {
    const data = d.data() as ComplianceDocument;
    return {
      id: d.id,
      type: data.type,
      name: data.name,
      status: data.status,
      expiresAt: data.expiresAt ? data.expiresAt.toDate().toISOString() : null,
    };
  });

  return NextResponse.json({
    nurse: {
      id: nurse.id,
      firstName: nurse.firstName,
      lastName: nurse.lastName,
      role: nurse.role,
      status: nurse.status,
      blockedReason: nurse.blockedReason ?? null,
    },
    shifts,
    documents,
  });
}
