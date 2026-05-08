import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { computeDocumentStatus, refreshNurseCompliance } from "@/lib/compliance";
import type { ComplianceDocument, Nurse } from "@/types";

export const runtime = "nodejs";

const VALID_TYPES: ComplianceDocument["type"][] = [
  "license",
  "certification",
  "background_check",
  "vaccination",
  "other",
];

// Vercel's serverless body limit is 4.5 MB; cap below that with a small margin
// for the multipart envelope overhead.
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const nurseSnap = await adminDb
    .collection("nurses")
    .where("portalToken", "==", params.token)
    .limit(1)
    .get();
  if (nurseSnap.empty) {
    return NextResponse.json({ error: "invalid link" }, { status: 404 });
  }
  const nurseDoc = nurseSnap.docs[0]!;
  const nurse = nurseDoc.data() as Nurse;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "couldn't parse upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Max 4 MB. Compress the PDF or take a clearer photo." },
      { status: 413 },
    );
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type (${file.type}). Use PDF, JPG, PNG, or HEIC.` },
      { status: 400 },
    );
  }

  const typeStr = String(form.get("type") ?? "");
  if (!VALID_TYPES.includes(typeStr as ComplianceDocument["type"])) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  const type = typeStr as ComplianceDocument["type"];
  const nameRaw = String(form.get("name") ?? "").trim();
  const name = nameRaw.length > 0 ? nameRaw : file.name;
  const expiresStr = form.get("expiresAt");
  const expiresAt =
    typeof expiresStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(expiresStr)
      ? new Date(expiresStr)
      : null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `documents/${nurseDoc.id}/${Date.now()}-${safeName}`;
  const downloadToken = randomUUID();

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await adminStorage.bucket().file(path).save(buffer, {
      contentType: file.type || "application/octet-stream",
      metadata: {
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });
  } catch (err) {
    console.error("storage upload failed", err);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  const bucketName = adminStorage.bucket().name;
  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path,
  )}?alt=media&token=${downloadToken}`;

  const status = computeDocumentStatus(expiresAt);
  const now = Timestamp.now();
  await adminDb.collection("documents").add({
    nurseId: nurseDoc.id,
    nurseName: `${nurse.firstName} ${nurse.lastName}`,
    type,
    name,
    fileUrl,
    storagePath: path,
    status,
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : undefined,
    uploadedAt: now,
    uploadedBy: nurseDoc.id,
  });

  // If the new upload's expiration is fine, refreshNurseCompliance unblocks
  // a nurse whose only blocker was an expired version of this same doc.
  if (nurseDoc.id) {
    await refreshNurseCompliance(nurseDoc.id);
  }

  return NextResponse.json({ ok: true });
}
