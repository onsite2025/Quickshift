import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Facility,
  ParsedFacilityIntent,
  ShiftCode,
  NurseRole,
} from "@/types";

const VALID_CODES: ShiftCode[] = ["AM", "PM", "NOC"];
const VALID_ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

const SYSTEM_PROMPT = `You triage SMS messages sent to a nursing registry. Read the inbound text and return STRICT JSON describing the sender's intent.

Return one of these exact shapes (no prose, no code fences, no markdown):

A) The facility wants to fill a shift:
{
  "action": "request",
  "date": "YYYY-MM-DD",
  "shiftCode": "AM" | "PM" | "NOC",
  "role": "RN" | "LPN" | "CNA" | "NP",
  "count": number,
  "notes": string | null
}

B) The facility wants to cancel a shift or all open requests:
{
  "action": "cancel",
  "scope": "all" | "specific",
  "details": string | null
}

C) The message is too short, a greeting, a thank-you, a question, or otherwise NOT a clear staffing request OR cancellation:
{
  "action": "unclear",
  "reason": string
}

Strict rules:
- Single letters, "a", "ok", "thanks", "hi", "yes", "no", greetings, status questions, or anything that isn't an explicit staffing request or cancellation -> action: "unclear".
- "Cancel everything", "cancel all my shifts", "pull all", "we don't need anyone" -> cancel, scope: "all".
- "Cancel the AM tomorrow", "drop the Friday CNA" -> cancel, scope: "specific", put the specifics in details.
- Time-of-day keywords for requests: "tonight"/"overnight"/"graveyard" = NOC; "morning"/"day"/"AM" = AM; "afternoon"/"evening"/"PM" = PM.
- If role is missing or ambiguous in a request, default to "CNA". If count is missing, default to 1.
- If date is missing, use the next upcoming day matching the time-of-day in the message.
- When in doubt, choose "unclear" over fabricating a request.
- Output VALID JSON only.`;

export const parseFacilitySms = async (
  text: string,
  facility: Facility,
  todayIso: string,
): Promise<ParsedFacilityIntent> => {
  const trimmed = text.trim();
  // Cheap pre-filter: ignore obvious non-messages without burning tokens.
  if (trimmed.length < 5 || trimmed.split(/\s+/).length < 2) {
    return { action: "unclear", reason: "too short" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today is ${todayIso}. Facility: ${facility.name} (${facility.city}, ${facility.state}).\n\nIncoming SMS:\n"""\n${trimmed}\n"""`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  let parsed: { action?: string; [k: string]: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { action: "unclear", reason: "AI returned non-JSON" };
  }

  if (parsed.action === "request") {
    const shiftCode = VALID_CODES.includes(parsed.shiftCode as ShiftCode)
      ? (parsed.shiftCode as ShiftCode)
      : "AM";
    const role = VALID_ROLES.includes(parsed.role as NurseRole)
      ? (parsed.role as NurseRole)
      : "CNA";
    const count =
      typeof parsed.count === "number" && parsed.count >= 1 ? parsed.count : 1;
    const date =
      typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? parsed.date
        : todayIso;
    const notes =
      typeof parsed.notes === "string" && parsed.notes.length > 0
        ? parsed.notes
        : undefined;
    return { action: "request", date, shiftCode, role, count, notes };
  }

  if (parsed.action === "cancel") {
    const scope = parsed.scope === "specific" ? "specific" : "all";
    const details =
      typeof parsed.details === "string" && parsed.details.length > 0
        ? parsed.details
        : undefined;
    return { action: "cancel", scope, details };
  }

  return {
    action: "unclear",
    reason:
      typeof parsed.reason === "string" ? parsed.reason : "could not classify",
  };
};
