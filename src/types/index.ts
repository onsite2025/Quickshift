import { Timestamp } from "firebase/firestore";

export type NurseRole = "RN" | "LPN" | "CNA" | "NP";
export type ShiftStatus = "open" | "assigned" | "in_progress" | "completed" | "cancelled";
export type DocumentStatus = "valid" | "expiring" | "expired" | "pending_review";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Nurse {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: NurseRole;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpires?: Timestamp;
  hourlyRate?: number;
  status: "active" | "inactive" | "on_leave";
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
  billingRate?: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Shift {
  id?: string;
  facilityId: string;
  facilityName: string;
  nurseId?: string;
  nurseName?: string;
  role: NurseRole;
  start: Timestamp;
  end: Timestamp;
  status: ShiftStatus;
  hourlyRate: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ComplianceDocument {
  id?: string;
  nurseId: string;
  type: "license" | "certification" | "background_check" | "vaccination" | "other";
  name: string;
  fileUrl: string;
  status: DocumentStatus;
  issuedAt?: Timestamp;
  expiresAt?: Timestamp;
  uploadedAt: Timestamp;
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
  notes?: string;
  createdAt: Timestamp;
}

export interface Invoice {
  id?: string;
  facilityId: string;
  facilityName: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  issuedAt: Timestamp;
  dueAt: Timestamp;
  paidAt?: Timestamp;
}

export interface InvoiceLineItem {
  shiftId: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
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
