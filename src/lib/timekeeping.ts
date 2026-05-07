import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type { Shift, Timesheet } from "@/types";

const findActiveShift = async (nursePhone: string) => {
  const snap = await adminDb
    .collection("shifts")
    .where("nursePhone", "==", nursePhone)
    .where("status", "in", ["confirmed", "in_progress"])
    .orderBy("start", "asc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...(doc.data() as Shift) };
};

export const clockIn = async (nursePhone: string) => {
  const shift = await findActiveShift(nursePhone);
  if (!shift) return { ok: false as const, reason: "no_shift" as const };

  const existing = await adminDb
    .collection("timesheets")
    .where("shiftId", "==", shift.id)
    .limit(1)
    .get();

  const now = Timestamp.now();

  if (!existing.empty) {
    const ts = existing.docs[0]!;
    return {
      ok: true as const,
      shift,
      timesheet: { id: ts.id, ...(ts.data() as Timesheet) },
    };
  }

  const ref = await adminDb.collection("timesheets").add({
    shiftId: shift.id!,
    nurseId: shift.nurseId!,
    nurseName: shift.nurseName!,
    facilityId: shift.facilityId,
    facilityName: shift.facilityName,
    clockIn: now,
    approved: false,
    exportedToGusto: false,
    createdAt: now,
  });

  await adminDb.collection("shifts").doc(shift.id!).update({
    status: "in_progress",
    updatedAt: now,
  });

  return { ok: true as const, shift, timesheetId: ref.id };
};

export const clockOut = async (nursePhone: string) => {
  const snap = await adminDb
    .collection("shifts")
    .where("nursePhone", "==", nursePhone)
    .where("status", "==", "in_progress")
    .orderBy("start", "asc")
    .limit(1)
    .get();
  if (snap.empty) return { ok: false as const, reason: "no_shift" as const };

  const shiftDoc = snap.docs[0]!;
  const shift = { id: shiftDoc.id, ...(shiftDoc.data() as Shift) };

  const tsSnap = await adminDb
    .collection("timesheets")
    .where("shiftId", "==", shift.id)
    .limit(1)
    .get();
  if (tsSnap.empty) return { ok: false as const, reason: "no_timesheet" as const };

  const tsDoc = tsSnap.docs[0]!;
  const ts = tsDoc.data() as Timesheet;
  const now = Timestamp.now();
  const totalHours =
    (now.toMillis() - ts.clockIn.toMillis()) / 1000 / 60 / 60;

  await tsDoc.ref.update({
    clockOut: now,
    totalHours: Math.round(totalHours * 100) / 100,
  });

  await shiftDoc.ref.update({ status: "completed", updatedAt: now });

  return { ok: true as const, shift, totalHours };
};
