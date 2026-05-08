import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { broadcastShift, duplicateShift } from "@/lib/dispatch";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const requireUser = async (req: NextRequest) => {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    console.warn("[duplicate] no Bearer token on request");
    return null;
  }
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (err) {
    console.error(
      "[duplicate] verifyIdToken failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const dates = Array.isArray(body?.dates)
    ? body.dates.filter(
        (d: unknown): d is string =>
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
      )
    : [];
  if (dates.length === 0) {
    return NextResponse.json(
      { error: "dates[] required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  const broadcast: boolean = Boolean(body?.broadcast);
  const nurseIds: string[] | undefined = Array.isArray(body?.nurseIds)
    ? body.nurseIds.filter((x: unknown): x is string => typeof x === "string")
    : undefined;

  let result;
  try {
    result = await duplicateShift(params.id, dates);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "duplicate failed" },
      { status: 500 },
    );
  }

  let broadcastedCount = 0;
  if (broadcast) {
    for (const c of result.created) {
      try {
        await broadcastShift(c.id, nurseIds && nurseIds.length > 0 ? { nurseIds } : {});
        broadcastedCount++;
      } catch (err) {
        console.error("duplicate broadcast failed for", c.id, err);
      }
    }
  }

  void writeAudit({
    actorUid: user.uid,
    actorEmail: user.email ?? "",
    action: "shift.duplicated",
    targetType: "shift",
    targetId: params.id,
    details: {
      createdIds: result.created.map((c) => c.id),
      dates: result.created.map((c) => c.date),
      broadcast,
      broadcastedCount,
    },
  });

  return NextResponse.json({
    ok: true,
    created: result.created,
    broadcastedCount,
  });
}
