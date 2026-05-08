import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { clockIn, clockOut } from "@/lib/timekeeping";
import type { Nurse } from "@/types";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const snap = await adminDb
    .collection("nurses")
    .where("portalToken", "==", params.token)
    .limit(1)
    .get();
  if (snap.empty) {
    return NextResponse.json({ error: "invalid link" }, { status: 404 });
  }
  const nurse = snap.docs[0]!.data() as Nurse;
  if (!nurse.phone) {
    return NextResponse.json({ error: "nurse has no phone on file" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action === "in") {
    const r = await clockIn(nurse.phone);
    if (!r.ok) {
      return NextResponse.json({ error: "No active shift to clock in for." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "out") {
    const r = await clockOut(nurse.phone);
    if (!r.ok) {
      return NextResponse.json({ error: "No active shift to clock out from." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, hours: r.totalHours });
  }
  return NextResponse.json({ error: "action must be 'in' or 'out'" }, { status: 400 });
}
