import { NextRequest, NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => {
    params[k] = String(v);
  });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const url = `${proto}://${host}/api/twilio/status`;
  const signature = req.headers.get("x-twilio-signature");
  if (!validateTwilioSignature(signature, url, params)) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  // Useful telemetry: MessageSid, MessageStatus (sent/delivered/failed/undelivered)
  console.log("[twilio/status]", params.MessageSid, params.MessageStatus, params.ErrorCode ?? "");
  return new NextResponse(null, { status: 204 });
}
