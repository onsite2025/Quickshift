import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { buildGustoCSV } from "@/lib/gusto-export";
import type { Timesheet } from "@/types";

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

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end required (ISO date)" }, { status: 400 });
  }

  const startTs = Timestamp.fromDate(new Date(start));
  const endTs = Timestamp.fromDate(new Date(end));

  const snap = await adminDb
    .collection("timesheets")
    .where("clockIn", ">=", startTs)
    .where("clockIn", "<=", endTs)
    .where("approved", "==", true)
    .get();

  const rows = snap.docs.map((d) => d.data() as Timesheet);
  const csv = buildGustoCSV(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gusto-${start}-${end}.csv"`,
    },
  });
}
