import "server-only";
import twilio from "twilio";

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_PHONE_NUMBER;
// When set, outbound messages route through the Messaging Service so the
// approved 10DLC campaign + sender pool are applied. Preferred over `from`.
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

let _client: ReturnType<typeof twilio> | null = null;

export const twilioClient = () => {
  if (!sid || !token) {
    throw new Error("Twilio credentials missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
  }
  if (!_client) _client = twilio(sid, token);
  return _client;
};

export const sendSMS = async (to: string, body: string) => {
  const params: { to: string; body: string; from?: string; messagingServiceSid?: string } =
    { to, body };
  if (messagingServiceSid) {
    params.messagingServiceSid = messagingServiceSid;
  } else if (from) {
    params.from = from;
  } else {
    throw new Error(
      "Set TWILIO_MESSAGING_SERVICE_SID (recommended) or TWILIO_PHONE_NUMBER",
    );
  }
  const msg = await twilioClient().messages.create(params);
  return msg.sid;
};

export const validateTwilioSignature = (
  signature: string | null,
  url: string,
  params: Record<string, string>,
) => {
  if (process.env.TWILIO_VALIDATE_SIGNATURE === "false") return true;
  if (!signature || !token) return false;
  return twilio.validateRequest(token, signature, url, params);
};

export const normalizePhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
};

export const twiml = (body?: string) => {
  const r = new twilio.twiml.MessagingResponse();
  if (body) r.message(body);
  return r.toString();
};
