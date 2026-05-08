import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizePhone, sendSMS } from "@/lib/sms";
import type { Nurse } from "@/types";

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

  const ref = adminDb.collection("nurses").doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "nurse not found" }, { status: 404 });
  }
  const nurse = snap.data() as Nurse;

  const body = await req.json().catch(() => ({}));
  const overrideRaw =
    typeof body?.to === "string" && body.to.trim().length > 0 ? body.to.trim() : null;
  const targetPhone = overrideRaw ? normalizePhone(overrideRaw) : nurse.phone;
  if (!targetPhone) {
    return NextResponse.json({ error: "no phone to send to" }, { status: 400 });
  }

  let portalToken = nurse.portalToken;
  if (!portalToken) {
    portalToken = randomBytes(24).toString("hex");
    await ref.update({ portalToken, updatedAt: Timestamp.now() });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const link = `${proto}://${host}/n/${portalToken}`;
  const message = `Hi ${nurse.firstName}, this is QuickShift. Your private schedule is here: ${link}\n\nView your shifts, clock in/out, and update your profile. Bookmark this link.`;

  try {
    const sid = await sendSMS(targetPhone, message);
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
