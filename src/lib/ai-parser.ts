import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Facility,
  ParsedFacilityIntent,
  ParsedShiftRequest,
  ShiftCode,
  NurseRole,
} from "@/types";

const VALID_CODES: ShiftCode[] = ["AM", "PM", "NOC"];
const VALID_ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

const SYSTEM_PROMPT = `You triage SMS messages sent to a nursing-registry dispatcher. Read the inbound text and return STRICT JSON describing the sender's intent. No prose, no code fences.

Return one of these four exact shapes:

A) REQUEST — facility wants to fill one or more shifts.
{
  "action": "request",
  "shifts": [
    {"date":"YYYY-MM-DD","shiftCode":"AM"|"PM"|"NOC","role":"RN"|"LPN"|"CNA"|"NP","count":number,"notes":string|null}
  ]
}

B) MODIFY — facility wants to REPLACE a previous open request with one or more new shifts.
{
  "action": "modify",
  "shifts": [
    {"date":"YYYY-MM-DD","shiftCode":"AM"|"PM"|"NOC","role":"RN"|"LPN"|"CNA"|"NP","count":number,"notes":string|null}
  ],
  "details": string|null
}

C) CANCEL — facility no longer needs a shift / their open shifts.
{ "action":"cancel","scope":"all"|"specific","details":string|null }

D) UNCLEAR — message is too short, a greeting/thank-you, a question, or otherwise not a clear ask.
{ "action":"unclear","reason":string }

NATURAL-LANGUAGE TRIGGERS (real coordinators don't use exact keywords):

MODIFY (replace a previous request) — any of these phrasings:
- "actually X instead of Y" / "X instead of Y"
- "actually it should be" / "actually we need" / "wait, make it"
- "change it to" / "switch to" / "let's do"
- "scratch that, [new request]"
- A message where the facility contradicts a recent request AND specifies a replacement

CANCEL (no replacement, just drop the request):
- "cancel" / "cancel that" / "cancel everything"
- "never mind" / "nm" / "nevermind"
- "we got it covered" / "covered" / "all set" / "we're good" / "we're set"
- "found someone" / "filled internally" / "no longer needed" / "disregard"
- "actually..." followed by any of the above (NOT followed by a replacement request)

UNCLEAR:
- single letters, "a", "ok", "thanks", "hi", "yes", "no" (alone), greetings, generic questions
- anything that is NOT a request, modification, or cancellation

REQUEST — anything asking to fill a shift (no contradiction of prior message).

PARSING RULES:
- Time-of-day: "tonight"/"overnight"/"graveyard" -> NOC; "morning"/"day"/"AM" -> AM; "afternoon"/"evening"/"PM" -> PM.
- Role default: "CNA" if missing/ambiguous.
- Count default: 1 per shift entry. If a request asks for multiple of the same type ("2 CNAs AM"), you may use count=2 OR repeat the entry — both are accepted.
- For multiple distinct shifts in one message ("1 AM and 1 PM RN"), put each as a SEPARATE entry in the shifts array.

DATE RULES:
- The user message starts with "Today is <Weekday>, <Month> <Day>, <Year>". Use that as the anchor.
- "today" / "tonight" -> today's date.
- "tomorrow" -> today + 1.
- A bare day-of-week ("Wednesday", "Fri") -> the NEXT future occurrence. If today IS that weekday, use today.
- "next Wednesday" -> the Wednesday in the FOLLOWING calendar week (skip the immediate one).
- For modifications without a date, use today's date.
- Never return a past date.

WORKED EXAMPLES (input -> output JSON):

"need 1 cna noc tonight"
-> {"action":"request","shifts":[{"date":"<today>","shiftCode":"NOC","role":"CNA","count":1,"notes":null}]}

"2 RNs PM friday"
-> {"action":"request","shifts":[{"date":"<friday>","shiftCode":"PM","role":"RN","count":2,"notes":null}]}

"1 cna AM and 1 cna PM tomorrow"
-> {"action":"request","shifts":[{"date":"<tomorrow>","shiftCode":"AM","role":"CNA","count":1,"notes":null},{"date":"<tomorrow>","shiftCode":"PM","role":"CNA","count":1,"notes":null}]}

"actually it should be 1 AM 1 PM rns instead of 2 AM"
-> {"action":"modify","shifts":[{"date":"<inferred or today>","shiftCode":"AM","role":"RN","count":1,"notes":null},{"date":"<inferred or today>","shiftCode":"PM","role":"RN","count":1,"notes":null}],"details":"split 2 AM RNs into 1 AM + 1 PM"}

"wait make it 2 cnas instead of 1"
-> {"action":"modify","shifts":[{"date":"<today>","shiftCode":"AM","role":"CNA","count":2,"notes":null}],"details":"increase count from 1 to 2"}

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

TIE-BREAKING:
- Ambiguous between request and modify -> prefer modify if the message contains "actually", "wait", "instead", "scratch", "change", "switch", "let's do".
- Ambiguous between modify and cancel -> if the message provides a replacement spec, MODIFY; if no replacement, CANCEL.
- Ambiguous between cancel and unclear -> prefer CANCEL (false-positive cancel is recoverable; phantom shifts are not).

Output VALID JSON only.`;

const sanitizeSpec = (
  raw: Record<string, unknown>,
  todayIso: string,
): ParsedShiftRequest => {
  const shiftCode = VALID_CODES.includes(raw.shiftCode as ShiftCode)
    ? (raw.shiftCode as ShiftCode)
    : "AM";
  const role = VALID_ROLES.includes(raw.role as NurseRole)
    ? (raw.role as NurseRole)
    : "CNA";
  const count = typeof raw.count === "number" && raw.count >= 1 ? raw.count : 1;
  const date =
    typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
      ? raw.date
      : todayIso;
  const notes =
    typeof raw.notes === "string" && raw.notes.length > 0
      ? raw.notes
      : undefined;
  return { date, shiftCode, role, count, notes };
};

export const parseFacilitySms = async (
  text: string,
  facility: Facility,
  todayIso: string,
): Promise<ParsedFacilityIntent> => {
  const trimmed = text.trim();
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
    max_tokens: 512,
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

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { action: "unclear", reason: "AI returned non-JSON" };
  }

  if (parsed.action === "request" || parsed.action === "modify") {
    const arr = Array.isArray(parsed.shifts) ? parsed.shifts : [];
    if (arr.length === 0) {
      return { action: "unclear", reason: "no shifts in parsed result" };
    }
    const shifts = arr.map((s) =>
      sanitizeSpec(s as Record<string, unknown>, todayIso),
    );
    if (parsed.action === "modify") {
      return {
        action: "modify",
        shifts,
        details:
          typeof parsed.details === "string" && parsed.details.length > 0
            ? parsed.details
            : undefined,
      };
    }
    return { action: "request", shifts };
  }

  if (parsed.action === "cancel") {
    return {
      action: "cancel",
      scope: parsed.scope === "specific" ? "specific" : "all",
      details:
        typeof parsed.details === "string" && parsed.details.length > 0
          ? parsed.details
          : undefined,
    };
  }

  return {
    action: "unclear",
    reason:
      typeof parsed.reason === "string" ? parsed.reason : "could not classify",
  };
};
