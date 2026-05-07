// Structural Timestamp so both firebase/firestore and firebase-admin/firestore
// Timestamp instances satisfy it. Clients still import the real class for
// `Timestamp.fromDate(...)`; this only types the stored fields.
export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export type NurseRole = "RN" | "LPN" | "CNA" | "NP";
export type ShiftCode = "AM" | "PM" | "NOC";
export type ShiftStatus =
  | "draft"
  | "broadcasting"
  | "open"
  | "claimed"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";
export type DocumentStatus = "valid" | "expiring" | "expired" | "pending_review";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type NurseStatus = "active" | "inactive" | "on_leave" | "blocked";

export interface ShiftTemplate {
  code: ShiftCode;
  label: string;
  startTime: string;
  endTime: string;
  defaultRate?: number;
}

export interface Nurse {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: NurseRole;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpires?: Timestamp;
  hourlyRate?: number;
  status: NurseStatus;
  blockedReason?: string;
  facilityIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Facility {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  inboundPhone?: string;
  billingRate?: number;
  shiftTemplates: ShiftTemplate[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BroadcastRecipient {
  nurseId: string;
  nurseName: string;
  phone: string;
  sentAt: Timestamp;
  responded?: "yes" | "no";
  respondedAt?: Timestamp;
  messageSid?: string;
}

export interface Shift {
  id?: string;
  facilityId: string;
  facilityName: string;
  nurseId?: string;
  nurseName?: string;
  nursePhone?: string;
  role: NurseRole;
  shiftCode: ShiftCode;
  shiftLabel: string;
  date: string;
  start: Timestamp;
  end: Timestamp;
  status: ShiftStatus;
  hourlyRate: number;
  rawRequest?: string;
  notes?: string;
  broadcast?: BroadcastRecipient[];
  claimedAt?: Timestamp;
  invoiceId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ComplianceDocument {
  id?: string;
  nurseId: string;
  nurseName?: string;
  type: "license" | "certification" | "background_check" | "vaccination" | "other";
  name: string;
  fileUrl: string;
  storagePath?: string;
  status: DocumentStatus;
  issuedAt?: Timestamp;
  expiresAt?: Timestamp;
  uploadedAt: Timestamp;
  uploadedBy?: string;
}

export interface Timesheet {
  id?: string;
  shiftId: string;
  nurseId: string;
  nurseName: string;
  facilityId: string;
  facilityName: string;
  clockIn: Timestamp;
  clockOut?: Timestamp;
  totalHours?: number;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
  exportedToGusto?: boolean;
  notes?: string;
  createdAt: Timestamp;
}

export interface InvoiceLineItem {
  shiftId: string;
  description: string;
  date: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id?: string;
  number: string;
  facilityId: string;
  facilityName: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  issuedAt: Timestamp;
  dueAt: Timestamp;
  paidAt?: Timestamp;
  createdAt: Timestamp;
}

export interface Message {
  id?: string;
  threadId: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface ParsedShiftRequest {
  date: string;
  shiftCode: ShiftCode;
  role: NurseRole;
  count: number;
  notes?: string;
}
