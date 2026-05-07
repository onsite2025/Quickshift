import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type { Invoice, InvoiceLineItem, Shift, Timesheet } from "@/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export interface GenerateInvoiceInput {
  facilityId: string;
  facilityName: string;
  periodStart: Date;
  periodEnd: Date;
  taxRate?: number;
  dueInDays?: number;
}

export const generateInvoice = async (input: GenerateInvoiceInput): Promise<Invoice> => {
  const periodStart = Timestamp.fromDate(input.periodStart);
  const periodEnd = Timestamp.fromDate(input.periodEnd);

  const shiftsSnap = await adminDb
    .collection("shifts")
    .where("facilityId", "==", input.facilityId)
    .where("status", "==", "completed")
    .where("start", ">=", periodStart)
    .where("start", "<=", periodEnd)
    .get();

  const shifts = shiftsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Shift) }));

  const lineItems: InvoiceLineItem[] = [];
  let subtotal = 0;

  for (const shift of shifts) {
    if (shift.invoiceId) continue;

    const tsSnap = await adminDb
      .collection("timesheets")
      .where("shiftId", "==", shift.id)
      .limit(1)
      .get();
    if (tsSnap.empty) continue;
    const ts = tsSnap.docs[0]!.data() as Timesheet;
    if (!ts.totalHours) continue;

    const rate = shift.hourlyRate ?? 0;
    const amountCents = Math.round(rate * ts.totalHours * 100);
    subtotal += amountCents;

    lineItems.push({
      shiftId: shift.id!,
      description: `${shift.nurseName} • ${shift.role} • ${shift.shiftLabel}`,
      date: shift.date,
      hours: ts.totalHours,
      rate,
      amount: amountCents,
    });
  }

  const taxRate = input.taxRate ?? 0;
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;
  const now = Timestamp.now();
  const dueAt = Timestamp.fromMillis(now.toMillis() + (input.dueInDays ?? 14) * ONE_DAY_MS);
  const number = `INV-${fmtDate(input.periodEnd).replace(/-/g, "")}-${input.facilityId.slice(0, 4).toUpperCase()}`;

  const invoice: Omit<Invoice, "id"> = {
    number,
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    periodStart,
    periodEnd,
    lineItems,
    subtotal,
    tax,
    total,
    amountPaid: 0,
    status: "draft",
    issuedAt: now,
    dueAt,
    createdAt: now,
  };

  const ref = await adminDb.collection("invoices").add(invoice);

  const batch = adminDb.batch();
  for (const item of lineItems) {
    batch.update(adminDb.collection("shifts").doc(item.shiftId), {
      invoiceId: ref.id,
    });
  }
  await batch.commit();

  return { id: ref.id, ...invoice };
};
