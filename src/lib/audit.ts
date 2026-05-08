import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

export interface WriteAuditParams {
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  details?: Record<string, unknown>;
}

// Best-effort audit write. Never throws — an audit failure should not break
// the user-facing action.
export const writeAudit = async (params: WriteAuditParams): Promise<void> => {
  try {
    await adminDb.collection("auditLogs").add({
      actor: { uid: params.actorUid, email: params.actorEmail },
      action: params.action,
      target: {
        type: params.targetType,
        id: params.targetId,
        name: params.targetName,
      },
      details: params.details ?? {},
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    console.error("audit write failed", { action: params.action }, err);
  }
};
