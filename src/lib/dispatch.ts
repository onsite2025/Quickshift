import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { sendSMS } from "./sms";
import type {
  Facility,
  Nurse,
  Shift,
  ShiftTemplate,
  ParsedShiftRequest,
  BroadcastRecipient,
} from "@/types";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const buildShiftTimestamps = (date: string, template: ShiftTemplate) => {
  // Wall-clock time stored as UTC; same convention everywhere so that whatever
  // hours the facility set in the template are exactly what users see, no
  // matter what timezone server or browser is in.
  const start = new Date(`${date}T${padTime(template.startTime)}:00.000Z`);
  let end = new Date(`${date}T${padTime(template.endTime)}:00.000Z`);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
  };
};

const padTime = (t: string) => {
  const [h, m] = t.split(":");
  return `${(h ?? "00").padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
};

export const createShiftFromRequest = async (
  facility: Facility,
  parsed: ParsedShiftRequest,
  rawRequest: string,
): Promise<{ id: string; shift: Shift }> => {
  const template =
    facility.shiftTemplates.find((t) => t.code === parsed.shiftCode) ??
    facility.shiftTemplates[0];

  if (!template) throw new Error(`Facility ${facility.name} has no shift templates configured`);

  const { start, end } = buildShiftTimestamps(parsed.date, template);
  const now = Timestamp.now();

  const shift: Omit<Shift, "id"> = {
    facilityId: facility.id!,
    facilityName: facility.name,
    role: parsed.role,
    shiftCode: parsed.shiftCode,
    shiftLabel: template.label,
    date: parsed.date,
    start,
    end,
    status: "draft",
    hourlyRate: template.defaultRate ?? facility.billingRate ?? 0,
    rawRequest,
    notes: parsed.notes ?? undefined,
    broadcast: [],
    createdAt: now,
    updatedAt: now,
  };

  const ref = await adminDb.collection("shifts").add(shift);
  return { id: ref.id, shift: { id: ref.id, ...shift } };
};

export const broadcastShift = async (shiftId: string): Promise<{ sent: number }> => {
  const shiftSnap = await adminDb.collection("shifts").doc(shiftId).get();
  if (!shiftSnap.exists) throw new Error("Shift not found");
  const shift = shiftSnap.data() as Shift;

  const eligibleSnap = await adminDb
    .collection("nurses")
    .where("status", "==", "active")
    .where("role", "==", shift.role)
    .get();

  const nurses = eligibleSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Nurse) }))
    .filter((n) => n.phone);

  const recipients: BroadcastRecipient[] = [];
  const start = shift.start.toDate();
  const message = `QuickShift: ${shift.facilityName} needs a ${shift.role} for ${shift.shiftLabel} on ${fmtDate(shift.date)} (${formatRange(shift.start.toDate(), shift.end.toDate())}). Reply YES ${shiftId.slice(0, 6).toUpperCase()} to claim.`;

  for (const nurse of nurses) {
    try {
      const sid = await sendSMS(nurse.phone, message);
      recipients.push({
        nurseId: nurse.id!,
        nurseName: `${nurse.firstName} ${nurse.lastName}`,
        phone: nurse.phone,
        sentAt: Timestamp.now(),
        messageSid: sid,
      });
    } catch (err) {
      console.error(`SMS failed for nurse ${nurse.id}`, err);
    }
  }

  await adminDb.collection("shifts").doc(shiftId).update({
    status: "open",
    broadcast: recipients,
    updatedAt: Timestamp.now(),
  });

  void start;
  return { sent: recipients.length };
};

const formatRange = (start: Date, end: Date) => {
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  return `${fmt(start)}–${fmt(end)}`;
};

export interface ClaimResult {
  ok: boolean;
  reason?: "not_open" | "not_invited" | "not_found";
  shift?: Shift;
}

export const claimShift = async (
  shortCode: string,
  nursePhone: string,
): Promise<ClaimResult> => {
  const upper = shortCode.toUpperCase();
  const matches = await adminDb
    .collection("shifts")
    .where("status", "in", ["open", "broadcasting"])
    .get();

  const shiftDoc = matches.docs.find((d) => d.id.slice(0, 6).toUpperCase() === upper);
  if (!shiftDoc) return { ok: false, reason: "not_found" };

  const shiftRef = adminDb.collection("shifts").doc(shiftDoc.id);

  return adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(shiftRef);
    if (!fresh.exists) return { ok: false, reason: "not_found" };
    const data = fresh.data() as Shift;

    if (data.status !== "open" && data.status !== "broadcasting") {
      return { ok: false, reason: "not_open" };
    }

    const recipient = data.broadcast?.find((r) => r.phone === nursePhone);
    if (!recipient) return { ok: false, reason: "not_invited" };

    const now = Timestamp.now();
    const updatedBroadcast = (data.broadcast ?? []).map((r) =>
      r.phone === nursePhone ? { ...r, responded: "yes" as const, respondedAt: now } : r,
    );

    tx.update(shiftRef, {
      status: "confirmed",
      nurseId: recipient.nurseId,
      nurseName: recipient.nurseName,
      nursePhone: recipient.phone,
      claimedAt: now,
      broadcast: updatedBroadcast,
      updatedAt: now,
    });

    const updated: Shift = {
      ...data,
      id: shiftDoc.id,
      status: "confirmed",
      nurseId: recipient.nurseId,
      nurseName: recipient.nurseName,
      nursePhone: recipient.phone,
      claimedAt: now,
      broadcast: updatedBroadcast,
      updatedAt: now,
    };
    return { ok: true, shift: updated };
  });
};

export const cancelSpecificShifts = async (
  facilityId: string,
  shiftIds: string[],
): Promise<{ count: number; cancelled: Shift[] }> => {
  if (shiftIds.length === 0) return { count: 0, cancelled: [] };

  const cancelled: Shift[] = [];
  const batch = adminDb.batch();
  const now = Timestamp.now();

  for (const id of shiftIds) {
    const ref = adminDb.collection("shifts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = snap.data() as Shift;
    // Only let the cancel touch shifts that belong to this facility AND are
    // still pre-claim. Confirmed/in-progress/completed/cancelled stay put.
    if (data.facilityId !== facilityId) continue;
    if (!["draft", "open", "broadcasting"].includes(data.status)) continue;
    batch.update(ref, { status: "cancelled", updatedAt: now });
    cancelled.push({ ...data, id });
  }

  if (cancelled.length === 0) return { count: 0, cancelled: [] };
  await batch.commit();
  return { count: cancelled.length, cancelled };
};

export const cancelOpenFacilityShifts = async (
  facilityId: string,
): Promise<{ count: number }> => {
  const snap = await adminDb
    .collection("shifts")
    .where("facilityId", "==", facilityId)
    .where("status", "in", ["draft", "open", "broadcasting"])
    .get();

  if (snap.empty) return { count: 0 };

  const batch = adminDb.batch();
  const now = Timestamp.now();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: "cancelled", updatedAt: now });
  }
  await batch.commit();

  return { count: snap.size };
};

export const sendClaimConfirmations = async (shift: Shift) => {
  const start = shift.start.toDate();
  const end = shift.end.toDate();

  const nurseMsg = `QuickShift: confirmed! ${shift.facilityName} • ${shift.shiftLabel} on ${fmtDate(shift.date)} (${formatRange(start, end)}). Reply IN to clock in when you arrive.`;

  if (shift.nursePhone) {
    try {
      await sendSMS(shift.nursePhone, nurseMsg);
    } catch (err) {
      console.error("nurse confirmation SMS failed", err);
    }
  }

  const facilitySnap = await adminDb.collection("facilities").doc(shift.facilityId).get();
  const facility = facilitySnap.data() as Facility | undefined;
  const facilityPhone = facility?.inboundPhone ?? facility?.contactPhone;
  if (facilityPhone) {
    const facilityMsg = `QuickShift: ${shift.nurseName} (${shift.nursePhone}) is confirmed for ${shift.shiftLabel} on ${fmtDate(shift.date)} (${formatRange(start, end)}).`;
    try {
      await sendSMS(facilityPhone, facilityMsg);
    } catch (err) {
      console.error("facility confirmation SMS failed", err);
    }
  }
};
