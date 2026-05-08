import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendSMS } from "@/lib/sms";
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

  const snap = await adminDb.collection("facilities").doc(params.id).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "facility not found" }, { status: 404 });
  }
  const facility = snap.data() as Facility;

  if (!facility.portalToken) {
    return NextResponse.json({ error: "no portal token on facility" }, { status: 400 });
  }
  if (!facility.contactPhone) {
    return NextResponse.json({ error: "no contact phone on facility" }, { status: 400 });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const baseUrl = `${proto}://${host}`;
  const link = `${baseUrl}/f/${facility.portalToken}`;
  const message = `Welcome to QuickShift, ${facility.name}! Your private portal: ${link}\n\nUse it to request shifts, see who's coming, or cancel open requests. Bookmark this link.`;

  try {
    const sid = await sendSMS(facility.contactPhone, message);
    return NextResponse.json({ ok: true, sid });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SMS failed" },
      { status: 500 },
    );
  }
}
