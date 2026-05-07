import { NextRequest, NextResponse } from "next/server";
import { generateInvoice } from "@/lib/invoices";
import { adminAuth } from "@/lib/firebase-admin";

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

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.facilityId || !body?.facilityName || !body?.periodStart || !body?.periodEnd) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  try {
    const invoice = await generateInvoice({
      facilityId: body.facilityId,
      facilityName: body.facilityName,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      taxRate: body.taxRate,
      dueInDays: body.dueInDays,
    });
    return NextResponse.json({ invoice });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invoice failed" },
      { status: 500 },
    );
  }
}
