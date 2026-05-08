import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { writeAudit } from "@/lib/audit";
import type { Facility } from "@/types";

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

  const ref = adminDb.collection("facilities").doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "facility not found" }, { status: 404 });
  }

  const facility = snap.data() as Facility;
  const portalToken = randomBytes(24).toString("hex");
  await ref.update({ portalToken, updatedAt: Timestamp.now() });

  void writeAudit({
    actorUid: user.uid,
    actorEmail: user.email ?? "",
    action: "facility.token_rotated",
    targetType: "facility",
    targetId: params.id,
    targetName: facility.name,
  });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return NextResponse.json({
    ok: true,
    portalToken,
    link: `${proto}://${host}/f/${portalToken}`,
  });
}
