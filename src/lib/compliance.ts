import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type { ComplianceDocument, DocumentStatus, Nurse } from "@/types";

const EXPIRY_WARNING_DAYS = 30;

export const computeDocumentStatus = (
  expiresAt: Date | null,
): DocumentStatus => {
  if (!expiresAt) return "valid";
  const now = Date.now();
  const diff = expiresAt.getTime() - now;
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days <= EXPIRY_WARNING_DAYS) return "expiring";
  return "valid";
};

export const refreshNurseCompliance = async (nurseId: string) => {
  const docsSnap = await adminDb
    .collection("documents")
    .where("nurseId", "==", nurseId)
    .get();

  let hasExpired = false;
  const updates: Promise<unknown>[] = [];

  for (const d of docsSnap.docs) {
    const data = d.data() as ComplianceDocument;
    const expires = data.expiresAt?.toDate() ?? null;
    const status = computeDocumentStatus(expires);
    if (status === "expired") hasExpired = true;
    if (status !== data.status) {
      updates.push(d.ref.update({ status }));
    }
  }
  await Promise.all(updates);

  const nurseRef = adminDb.collection("nurses").doc(nurseId);
  const nurseSnap = await nurseRef.get();
  if (!nurseSnap.exists) return { blocked: hasExpired };
  const nurse = nurseSnap.data() as Nurse;

  const now = Timestamp.now();
  if (hasExpired && nurse.status !== "blocked") {
    await nurseRef.update({
      status: "blocked",
      blockedReason: "Expired compliance document",
      updatedAt: now,
    });
  } else if (!hasExpired && nurse.status === "blocked" && nurse.blockedReason?.includes("compliance")) {
    await nurseRef.update({
      status: "active",
      blockedReason: null,
      updatedAt: now,
    });
  }

  return { blocked: hasExpired };
};
