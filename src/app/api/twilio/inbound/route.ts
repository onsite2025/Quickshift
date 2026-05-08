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
import {
  logFacilitySms,
  recentFacilityConversation,
  openFacilityShifts,
} from "@/lib/sms-log";
import type { Facility, Nurse, ParsedShiftRequest } from "@/types";

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
  const facilityPhone = facility.inboundPhone ?? "";

  // Fetch context BEFORE logging the new inbound, so the latest message is
  // passed in via the prompt, not duplicated in "Recent conversation".
  const [recentMessages, openShifts] = await Promise.all([
    recentFacilityConversation(facility.id!),
    openFacilityShifts(facility.id!),
  ]);

  await logFacilitySms({
    facilityId: facility.id!,
    phone: facilityPhone,
    body,
    direction: "inbound",
  });

  const reply = async (text: string) => {
    await logFacilitySms({
      facilityId: facility.id!,
      phone: facilityPhone,
      body: text,
      direction: "outbound",
    });
    return xml(text);
  };

  if (!facility.shiftTemplates?.length) {
    return reply(
      `No shift templates configured for ${facility.name}. Please add AM/PM/NOC templates in QuickShift first.`,
    );
  }

  let intent;
  try {
    const today = new Date().toISOString().slice(0, 10);
    intent = await parseFacilitySms(body, facility, today, {
      recentMessages,
      openShifts,
    });
  } catch (err) {
    console.error("AI parse error", err);
    return reply(
      "Got your message — having trouble reading it. Your coordinator will follow up shortly.",
    );
  }

  if (intent.action === "reply") {
    if (!intent.text.trim()) return xml();
    return reply(intent.text);
  }

  if (intent.action === "cancel") {
    try {
      const { count } = await cancelOpenFacilityShifts(facility.id!);
      const tail =
        intent.scope === "specific"
          ? "For shifts already confirmed with a nurse, your coordinator will reach out."
          : "For shifts already claimed by a nurse, your coordinator will reach out.";
      return reply(
        `Cancelled ${count} open request${count === 1 ? "" : "s"}. ${tail}`,
      );
    } catch (err) {
      console.error("cancel error", err);
      return reply(
        "Couldn't process that cancellation. Your coordinator will follow up.",
      );
    }
  }

  // request or modify — both create new shifts; modify also cancels prior open ones
  try {
    let priorCancelled = 0;
    if (intent.action === "modify") {
      const result = await cancelOpenFacilityShifts(facility.id!);
      priorCancelled = result.count;
    }

    let createdCount = 0;
    for (const spec of intent.shifts) {
      const slots = Math.max(1, spec.count);
      for (let i = 0; i < slots; i++) {
        const single: ParsedShiftRequest = { ...spec, count: 1 };
        const { id } = await createShiftFromRequest(facility, single, body);
        await broadcastShift(id);
        createdCount++;
      }
    }

    const summary = summarizeShifts(intent.shifts, facility);
    if (intent.action === "modify") {
      const prior =
        priorCancelled > 0
          ? `Cancelled ${priorCancelled} prior open request${priorCancelled === 1 ? "" : "s"}. `
          : "";
      return reply(
        `${prior}Updated — now looking for ${summary}. We'll text you as soon as ${createdCount === 1 ? "it's" : "they're"} claimed.`,
      );
    }
    return reply(
      `Got it — looking for ${summary}. We'll text you as soon as ${createdCount === 1 ? "it's" : "they're"} claimed.`,
    );
  } catch (err) {
    console.error("dispatch error", err);
    return reply(
      "Something went wrong creating that shift. We'll follow up shortly.",
    );
  }
}

function summarizeShifts(shifts: ParsedShiftRequest[], facility: Facility): string {
  const items = shifts.map((s) => describeShift(s, facility));
  if (items.length === 0) return "no shifts";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function describeShift(s: ParsedShiftRequest, facility: Facility): string {
  const template = facility.shiftTemplates.find((t) => t.code === s.shiftCode);
  const shiftStr = template?.label ?? s.shiftCode;
  const [y, m, d] = s.date.split("-").map(Number);
  const friendlyDate = new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const article = ["RN", "LPN", "NP"].includes(s.role) ? "an" : "a";
  const subject = s.count > 1 ? `${s.count} ${s.role}s` : `${article} ${s.role}`;
  return `${subject} for ${shiftStr} on ${friendlyDate}`;
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
