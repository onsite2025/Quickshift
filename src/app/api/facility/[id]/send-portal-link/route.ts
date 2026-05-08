import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizePhone, sendSMS } from "@/lib/sms";
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

  // Optional override: send to a different phone than facility.contactPhone.
  const body = await req.json().catch(() => ({}));
  const overrideRaw =
    typeof body?.to === "string" && body.to.trim().length > 0 ? body.to.trim() : null;
  const targetPhone = overrideRaw
    ? normalizePhone(overrideRaw)
    : facility.contactPhone;
  if (!targetPhone) {
    return NextResponse.json(
      { error: "No phone number to send to. Add a contact phone or pass 'to'." },
      { status: 400 },
    );
  }

  // Generate a portal token if this facility doesn't have one yet (handles
  // facilities created before the portal feature shipped).
  let portalToken = facility.portalToken;
  if (!portalToken) {
    portalToken = randomBytes(24).toString("hex");
    await ref.update({ portalToken, updatedAt: Timestamp.now() });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const link = `${proto}://${host}/f/${portalToken}`;
  const message = `${facility.name}: your QuickShift portal — ${link}\n\nUse it to request shifts, see who's coming, or cancel open requests. Bookmark this link.`;

  try {
    const sid = await sendSMS(targetPhone, message);
    void writeAudit({
      actorUid: user.uid,
      actorEmail: user.email ?? "",
      action: "facility.portal_link_sent",
      targetType: "facility",
      targetId: params.id,
      targetName: facility.name,
      details: { sentTo: targetPhone },
    });
    return NextResponse.json({
      ok: true,
      sid,
      sentTo: targetPhone,
      portalToken,
      link,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SMS failed" },
      { status: 500 },
    );
  }
}
