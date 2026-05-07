import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { twiml, validateTwilioSignature, normalizePhone } from "@/lib/sms";
import { parseFacilitySms } from "@/lib/ai-parser";
import {
  createShiftFromRequest,
  broadcastShift,
  cancelOpenFacilityShifts,
  claimShift,
  sendClaimConfirmations,
} from "@/lib/dispatch";
import { clockIn, clockOut } from "@/lib/timekeeping";
import type { Facility, Nurse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const xml = (body?: string) =>
  new NextResponse(twiml(body), {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => {
    params[k] = String(v);
  });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const url = `${proto}://${host}/api/twilio/inbound`;
  const signature = req.headers.get("x-twilio-signature");
  if (!validateTwilioSignature(signature, url, params)) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const from = normalizePhone(params.From ?? "");
  const body = (params.Body ?? "").trim();
  if (!from || !body) return xml();

  const facilitySnap = await adminDb
    .collection("facilities")
    .where("inboundPhone", "==", from)
    .limit(1)
    .get();

  if (!facilitySnap.empty) {
    return handleFacilityRequest(facilitySnap.docs[0]!, body);
  }

  const nurseSnap = await adminDb
    .collection("nurses")
    .where("phone", "==", from)
    .limit(1)
    .get();

  if (!nurseSnap.empty) {
    return handleNurseSms(nurseSnap.docs[0]!.data() as Nurse, from, body);
  }

  return xml("Sorry, this number isn't registered with QuickShift. Please contact your coordinator.");
}

async function handleFacilityRequest(
  facilityDoc: FirebaseFirestore.QueryDocumentSnapshot,
  body: string,
) {
  const facility: Facility = { id: facilityDoc.id, ...(facilityDoc.data() as Facility) };
  if (!facility.shiftTemplates?.length) {
    return xml(`No shift templates configured for ${facility.name}. Please add AM/PM/NOC templates in QuickShift first.`);
  }

  let intent;
  try {
    const today = new Date().toISOString().slice(0, 10);
    intent = await parseFacilitySms(body, facility, today);
  } catch (err) {
    console.error("AI parse error", err);
    return xml("Got your message — having trouble reading it. Your coordinator will follow up shortly.");
  }

  if (intent.action === "unclear") {
    return xml(
      "Couldn't read that as a shift request. Try: '1 CNA NOC tonight'. To cancel open requests, text 'cancel all'. Reply STOP to opt out.",
    );
  }

  if (intent.action === "cancel") {
    try {
      const { count } = await cancelOpenFacilityShifts(facility.id!);
      const tail =
        intent.scope === "specific"
          ? "For shifts already confirmed with a nurse, your coordinator will reach out."
          : "For shifts already claimed by a nurse, your coordinator will reach out.";
      return xml(
        `Cancelled ${count} open request${count === 1 ? "" : "s"}. ${tail}`,
      );
    } catch (err) {
      console.error("cancel error", err);
      return xml("Couldn't process that cancellation. Your coordinator will follow up.");
    }
  }

  // intent.action === "request"
  try {
    const { id } = await createShiftFromRequest(facility, intent, body);
    await broadcastShift(id);
    const template =
      facility.shiftTemplates.find((t) => t.code === intent.shiftCode) ??
      facility.shiftTemplates[0];
    const [y, m, d] = intent.date.split("-").map(Number);
    const friendlyDate = new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const roleStr =
      intent.count > 1 ? `${intent.count} ${intent.role}s` : `a ${intent.role}`;
    const shiftStr = template?.label ?? intent.shiftCode;
    return xml(
      `Got it — looking for ${roleStr} for ${shiftStr} on ${friendlyDate}. We'll text you as soon as it's claimed.`,
    );
  } catch (err) {
    console.error("dispatch error", err);
    return xml("Something went wrong creating that shift. We'll follow up shortly.");
  }
}

async function handleNurseSms(nurse: Nurse, from: string, body: string) {
  const upper = body.toUpperCase();

  const yesMatch = upper.match(/^YES\s+([A-Z0-9]{4,8})/);
  if (yesMatch) {
    const code = yesMatch[1]!;
    const result = await claimShift(code, from);
    if (!result.ok) {
      const reason =
        result.reason === "not_open"
          ? "That shift was already claimed."
          : result.reason === "not_invited"
            ? "You weren't on the broadcast for that shift."
            : "We couldn't find that shift code.";
      return xml(`QuickShift: ${reason}`);
    }
    void sendClaimConfirmations(result.shift!);
    return xml(`QuickShift: confirmed! Details on the way.`);
  }

  if (upper.startsWith("IN")) {
    const r = await clockIn(from);
    if (!r.ok) return xml("QuickShift: no active shift to clock in for.");
    return xml(`QuickShift: clocked in at ${r.shift.facilityName}. Reply OUT when you finish.`);
  }

  if (upper.startsWith("OUT")) {
    const r = await clockOut(from);
    if (!r.ok) return xml("QuickShift: no shift to clock out from.");
    return xml(`QuickShift: clocked out. ${r.totalHours.toFixed(2)} hours recorded.`);
  }

  if (upper === "NO" || upper.startsWith("NO ")) {
    return xml("QuickShift: thanks for letting us know.");
  }

  return xml(
    `QuickShift commands: YES <CODE> to claim, IN to clock in, OUT to clock out, NO to decline.`,
  );
}
