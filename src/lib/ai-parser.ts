import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Facility,
  ParsedFacilityIntent,
  ParsedShiftRequest,
  ShiftCode,
  NurseRole,
} from "@/types";
import type { ConversationTurn, OpenShiftSummary } from "./sms-log";

export interface ParseContext {
  recentMessages?: ConversationTurn[];
  openShifts?: OpenShiftSummary[];
}

const VALID_CODES: ShiftCode[] = ["AM", "PM", "NOC"];
const VALID_ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

const SYSTEM_PROMPT = `You triage SMS messages sent to a nursing-registry dispatcher. Read the inbound text and return STRICT JSON describing the sender's intent. No prose, no code fences.

Return one of these five exact shapes:

A) REQUEST — facility wants to fill one or more shifts. Every shift entry MUST have a definite role and shiftCode.
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

D) NEEDS_CLARIFICATION — message looks like a request but is missing role OR shiftCode (and conversation context doesn't fill it in). NEVER guess these fields. Ask politely.
{ "action":"needs_clarification","question":string }

E) UNCLEAR — message is too short, a greeting/thank-you, a question, or otherwise not a clear ask AND not a clarification reply.
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
- Required fields per shift: role AND shiftCode must be EXPLICITLY present in the message OR derivable from "Currently open shifts" / "Recent conversation" context. If either is missing -> NEEDS_CLARIFICATION. NEVER guess.
- Count default: 1 if not stated. If a request asks for multiple of the same type ("2 CNAs AM"), use count=2 OR repeat the entry — both accepted.
- Date default: infer from words ("tonight" -> today, "tomorrow" -> today+1, weekday -> next future occurrence). If completely missing AND no clue at all, set date to today.
- For multiple distinct shifts in one message ("1 AM and 1 PM RN"), put each as a SEPARATE entry in the shifts array.

CLARIFICATION QUESTIONS — keep them short and use exact options:
- Missing role only: "Which role do you need? RN, LPN, or CNA?"
- Missing shift only: "Which shift — AM (7a-3p), PM (3p-11p), or NOC (11p-7a)?"
- Both missing: "Which role and shift? e.g. '3 CNA NOC' or '2 RN AM'."
- Always include the parts you DID parse, e.g. "Which role for the 3 NOC shifts tomorrow — RN, LPN, or CNA?"

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

"I need 3 noc shifts tomorrow" (no role specified, no prior context)
-> {"action":"needs_clarification","question":"Which role for the 3 NOC shifts tomorrow — RN, LPN, or CNA?"}

"need 2 cnas tomorrow" (no shift specified, no prior context)
-> {"action":"needs_clarification","question":"Which shift for the 2 CNAs tomorrow — AM (7a-3p), PM (3p-11p), or NOC (11p-7a)?"}

"need someone tonight" (no role or shift, just "tonight" -> NOC inferred)
-> {"action":"needs_clarification","question":"Which role do you need for tonight (NOC)? RN, LPN, or CNA?"}

After prior message "system: Which role for the 3 NOC shifts tomorrow — RN, LPN, or CNA?":
"CNA" -> {"action":"request","shifts":[{"date":"<tomorrow>","shiftCode":"NOC","role":"CNA","count":3,"notes":null}]}
"make em RNs" -> {"action":"request","shifts":[{"date":"<tomorrow>","shiftCode":"NOC","role":"RN","count":3,"notes":null}]}

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

CONVERSATION CONTEXT (when provided):
The user message may include "Recent conversation" and "Currently open shifts" sections from THIS facility. Use them to resolve ellipsis and references in short follow-up messages:
- "make it 2" / "double it" / "two of them" -> MODIFY of the most recent open shift, count adjusted.
- "switch to friday" / "move it to friday" -> MODIFY: change the date of the most recent open shift; keep role/shiftCode the same.
- "actually X instead of Y" -> MODIFY (replace prior open shifts with X).
- "and also a PM" / "add a PM too" / "also need an RN" -> REQUEST (ADDS a new shift on top of existing ones; do NOT cancel anything).
- "the second one" / "that one" -> reference to a specific open shift; treat as cancel/modify of just that one (scope: "specific" or include only that spec).
- A short ambiguous message with NO prior context -> UNCLEAR.

The "Currently open shifts" list tells you what role/shiftCode/date to inherit when the latest message doesn't specify them.

TIE-BREAKING:
- Ambiguous between request and modify -> prefer MODIFY if the message contains "actually", "wait", "instead", "scratch", "change", "switch", "make it", "let's do" — and there are open shifts to modify.
- Ambiguous between request and modify -> prefer REQUEST (additive) if the message starts with "and", "also", "plus", "add" — these mean ADD, not REPLACE.
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
  context: ParseContext = {},
): Promise<ParsedFacilityIntent> => {
  const trimmed = text.trim();
  // The pre-filter still helps for empty / one-letter messages that arrive
  // with no prior context. With context, even short messages can be valid
  // ("make it 2") so we let those through.
  const hasContext =
    (context.recentMessages?.length ?? 0) > 0 ||
    (context.openShifts?.length ?? 0) > 0;
  if (!hasContext && (trimmed.length < 5 || trimmed.split(/\s+/).length < 2)) {
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

  const userParts = [
    `Today is ${todayLabel} (ISO ${todayIso}). Facility: ${facility.name} (${facility.city}, ${facility.state}).`,
  ];

  if (context.recentMessages && context.recentMessages.length > 0) {
    userParts.push("\nRecent conversation (oldest first):");
    for (const turn of context.recentMessages) {
      const time = turn.ts.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      const who = turn.direction === "inbound" ? "facility" : "system";
      userParts.push(`[${time}] ${who}: ${turn.body}`);
    }
  }

  if (context.openShifts && context.openShifts.length > 0) {
    userParts.push("\nCurrently open / scheduled shifts for this facility:");
    for (const s of context.openShifts) {
      const claimed = s.nurseName ? ` (claimed by ${s.nurseName})` : "";
      userParts.push(
        `- ${s.date} ${s.shiftCode} ${s.role} [${s.status}]${claimed}`,
      );
    }
  } else if (context.openShifts) {
    userParts.push("\nThis facility has no open shifts right now.");
  }

  userParts.push(`\nIncoming SMS:\n"""\n${trimmed}\n"""`);

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userParts.join("\n") }],
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

  if (parsed.action === "needs_clarification") {
    const question =
      typeof parsed.question === "string" && parsed.question.length > 0
        ? parsed.question
        : "Which role and shift do you need? e.g. '1 CNA NOC tonight'.";
    return { action: "needs_clarification", question };
  }

  return {
    action: "unclear",
    reason:
      typeof parsed.reason === "string" ? parsed.reason : "could not classify",
  };
};
