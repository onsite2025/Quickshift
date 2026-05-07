import { collection, CollectionReference, DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import type {
  Nurse,
  Facility,
  Shift,
  ComplianceDocument,
  Timesheet,
  Invoice,
  Message,
  SmsLogEntry,
} from "@/types";

const typedCollection = <T = DocumentData>(name: string) =>
  collection(db, name) as CollectionReference<T>;

export const nursesCol = typedCollection<Nurse>("nurses");
export const facilitiesCol = typedCollection<Facility>("facilities");
export const shiftsCol = typedCollection<Shift>("shifts");
export const documentsCol = typedCollection<ComplianceDocument>("documents");
export const timesheetsCol = typedCollection<Timesheet>("timesheets");
export const invoicesCol = typedCollection<Invoice>("invoices");
export const messagesCol = typedCollection<Message>("messages");
export const smsLogsCol = typedCollection<SmsLogEntry>("smsLogs");

export const COLLECTIONS = {
  nurses: "nurses",
  facilities: "facilities",
  shifts: "shifts",
  documents: "documents",
  timesheets: "timesheets",
  invoices: "invoices",
  messages: "messages",
  smsLogs: "smsLogs",
} as const;
