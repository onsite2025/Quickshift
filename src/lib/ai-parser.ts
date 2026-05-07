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

Classification rules — READ CAREFULLY. Real coordinators write conversationally; do not require exact keywords.

CANCELLATION — any message that signals the facility no longer needs the staffing they recently asked for. Examples include but are not limited to:
- "cancel" / "cancel that" / "cancel everything" / "cancel my request"
- "never mind" / "nm" / "nevermind"
- "we got it covered" / "got it covered" / "covered" / "we're covered"
- "all set" / "we're good" / "we're set" / "we're fine"
- "found someone" / "filled internally" / "we found coverage"
- "no longer needed" / "no need" / "disregard"
- A message that starts with "actually..." or "wait..." and then expresses any of the above
Scope: "all" unless the message clearly references ONE specific shift ("cancel the AM tomorrow", "drop the Friday CNA"), in which case scope: "specific" and put the specifics in details. Default to "all" when the scope is unclear.

UNCLEAR — single letters, "a", "ok", "thanks", "hi", "yes", "no" (alone), greetings, generic questions, or anything that is NOT a staffing request and NOT a cancellation.

REQUEST — any message asking to fill a shift. Time-of-day: "tonight"/"overnight"/"graveyard" -> NOC; "morning"/"day"/"AM" -> AM; "afternoon"/"evening"/"PM" -> PM. Default role to "CNA" if missing. Default count to 1 if missing.

DATE rules:
- The user message starts with "Today is <Weekday>, <Month> <Day>, <Year>". Use that as the anchor.
- "today"/"tonight" -> today's date.
- "tomorrow" -> today + 1 day.
- A bare day-of-week ("Wednesday", "Fri") -> the NEXT future occurrence. If today IS that weekday, use today.
- "next Wednesday" -> the Wednesday in the FOLLOWING calendar week (skip the immediate one).
- Never return a past date. If you can't determine a date, use today.

WORKED EXAMPLES (input -> JSON):

"need 1 cna noc tonight"
-> {"action":"request","date":"<today>","shiftCode":"NOC","role":"CNA","count":1,"notes":null}

"actually pls cancel that, i got it covered"
-> {"action":"cancel","scope":"all","details":null}

"nm we're good"
-> {"action":"cancel","scope":"all","details":null}

"cancel the friday AM"
-> {"action":"cancel","scope":"specific","details":"Friday AM"}

"a"
-> {"action":"unclear","reason":"single letter, no request"}

"thanks!"
-> {"action":"unclear","reason":"acknowledgment, not a request"}

"2 RNs PM friday please"
-> {"action":"request","date":"<next friday>","shiftCode":"PM","role":"RN","count":2,"notes":null}

When intent is ambiguous between request and unclear, prefer "unclear". When intent is ambiguous between cancel and unclear, prefer "cancel" (false-positive cancellations are recoverable; phantom shifts are not).

Output VALID JSON only. No prose, no code fences.`;

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

  const [ty, tm, td] = todayIso.split("-").map(Number);
  const todayLabel = new Date(ty!, tm! - 1, td!).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today is ${todayLabel} (ISO ${todayIso}). Facility: ${facility.name} (${facility.city}, ${facility.state}).\n\nIncoming SMS:\n"""\n${trimmed}\n"""`,
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
