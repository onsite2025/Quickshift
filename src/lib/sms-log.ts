import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type { Shift, SmsLogEntry } from "@/types";

const CONTEXT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CONTEXT_LIMIT = 8;

export interface ConversationTurn {
  direction: "inbound" | "outbound";
  body: string;
  ts: Date;
}

export interface OpenShiftSummary {
  id: string;
  date: string;
  shiftCode: string;
  shiftLabel: string;
  role: string;
  status: string;
  nurseName?: string;
}

export const logFacilitySms = async (params: {
  facilityId: string;
  phone: string;
  body: string;
  direction: "inbound" | "outbound";
  twilioSid?: string;
}): Promise<void> => {
  try {
    await adminDb.collection("smsLogs").add({
      direction: params.direction,
      facilityId: params.facilityId,
      phone: params.phone,
      body: params.body,
      twilioSid: params.twilioSid,
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    // Logging must never break the conversation flow.
    console.error("logFacilitySms failed", err);
  }
};

export const recentFacilityConversation = async (
  facilityId: string,
): Promise<ConversationTurn[]> => {
  try {
    const cutoff = Timestamp.fromDate(new Date(Date.now() - CONTEXT_WINDOW_MS));
    const snap = await adminDb
      .collection("smsLogs")
      .where("facilityId", "==", facilityId)
      .where("createdAt", ">=", cutoff)
      .orderBy("createdAt", "desc")
      .limit(CONTEXT_LIMIT)
      .get();
    return snap.docs
      .map((d) => {
        const data = d.data() as SmsLogEntry;
        return {
          direction: data.direction,
          body: data.body.slice(0, 240),
          ts: data.createdAt.toDate(),
        };
      })
      .reverse();
  } catch (err) {
    console.error("recentFacilityConversation failed", err);
    return [];
  }
};

export const openFacilityShifts = async (
  facilityId: string,
): Promise<OpenShiftSummary[]> => {
  try {
    const snap = await adminDb
      .collection("shifts")
      .where("facilityId", "==", facilityId)
      .where("status", "in", ["draft", "open", "broadcasting", "confirmed"])
      .orderBy("start", "asc")
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as Shift;
      return {
        id: d.id,
        date: data.date,
        shiftCode: data.shiftCode,
        shiftLabel: data.shiftLabel,
        role: data.role,
        status: data.status,
        nurseName: data.nurseName,
      };
    });
  } catch (err) {
    console.error("openFacilityShifts failed", err);
    return [];
  }
};
