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

const SHIFT_SCHEMA = {
  type: "object",
  properties: {
    date: {
      type: "string",
      description: "ISO date YYYY-MM-DD in the facility's local timezone.",
    },
    shiftCode: { type: "string", enum: ["AM", "PM", "NOC"] },
    role: { type: "string", enum: ["RN", "LPN", "CNA", "NP"] },
    count: { type: "integer", minimum: 1 },
    notes: { type: "string" },
  },
  required: ["date", "shiftCode", "role", "count"],
} as const;

const TOOLS = [
  {
    name: "create_shifts",
    description:
      "Create one or more NEW shifts. Use when the facility is requesting staffing. This is ADDITIVE — call it even if the facility already has other open shifts. Do not call this if the message is correcting a prior request (use modify_shifts instead).",
    input_schema: {
      type: "object",
      properties: {
        shifts: { type: "array", items: SHIFT_SCHEMA, minItems: 1 },
      },
      required: ["shifts"],
    },
  },
  {
    name: "modify_shifts",
    description:
      "Cancel ALL of the facility's currently-open shifts and replace them with the provided ones. Use when the facility is CORRECTING a recent request — phrases like 'actually X instead of Y', 'make it 2', 'switch to Friday', 'wait, change that to'. Do not use for purely additive requests.",
    input_schema: {
      type: "object",
      properties: {
        replacements: { type: "array", items: SHIFT_SCHEMA, minItems: 1 },
        details: {
          type: "string",
          description: "Brief audit note describing what changed.",
        },
      },
      required: ["replacements"],
    },
  },
  {
    name: "cancel_shifts",
    description:
      "Cancel the facility's open shifts entirely without replacement. Use when the facility no longer needs the staffing they asked for — 'never mind', 'we got it covered', 'cancel everything', 'all set'. Use scope:'specific' if they referenced one particular shift.",
    input_schema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["all", "specific"] },
        details: { type: "string" },
      },
      required: ["scope"],
    },
  },
  {
    name: "reply_only",
    description:
      "Reply to the facility without taking any other action. Use for: clarifying questions when role or shiftCode is missing and not in conversation context (NEVER guess these); short polite acknowledgments to thank-yous or off-topic chatter. Pass an empty string for text to skip replying entirely (use sparingly — for clear noise like single random characters).",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "Exact reply text. Be friendly and concise. For ambiguous requests missing role or shift, ask plainly and include the parts you DID understand: e.g. 'Which role for the 3 NOC shifts tomorrow — RN, LPN, or CNA?'",
        },
      },
      required: ["text"],
    },
  },
];

const SYSTEM_PROMPT = `You are the SMS dispatcher for QuickCare Nursing Registry. Coordinators at partner healthcare facilities text in to request, modify, or cancel staffing for credentialed nurses (RN, LPN, CNA, NP).

Each turn, you'll see the latest inbound SMS, the facility's recent conversation with you (last hour), and a list of their currently-open shifts. Decide what to do and call EXACTLY ONE tool.

Two firm rules:
1. NEVER guess role or shiftCode. If a request lacks either and conversation context doesn't fill the gap, call reply_only with a short clarifying question that includes the parts you DID parse. Example: "Which role for the 3 NOC shifts tomorrow — RN, LPN, or CNA?"
2. Distinguish ADDITIVE from REPLACEMENT:
   - "and also a PM", "add an RN too", "plus 1 LPN" -> create_shifts (additive).
   - "actually 1 PM instead of 1 AM", "make it 2", "switch to Friday", "wait, change that" -> modify_shifts (replaces all open shifts).

Date inference: "tonight"/"overnight"/"graveyard" -> today, NOC; "tomorrow" -> today+1; bare weekday -> next future occurrence (today if today is that weekday); "next <weekday>" -> the following week's. Default to today if no date words at all. Never set a past date.

Time-of-day mapping: morning/AM -> AM; afternoon/evening/PM -> PM; overnight/graveyard/tonight -> NOC.

Be conversational. Short follow-ups like "CNA", "make it 2", "switch to Friday" only make sense in context — read the recent conversation carefully before deciding.`;

const sanitizeShiftArray = (
  raw: unknown,
  todayIso: string,
): ParsedShiftRequest[] => {
  if (!Array.isArray(raw)) return [];
  const result: ParsedShiftRequest[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const shiftCode = VALID_CODES.includes(obj.shiftCode as ShiftCode)
      ? (obj.shiftCode as ShiftCode)
      : null;
    const role = VALID_ROLES.includes(obj.role as NurseRole)
      ? (obj.role as NurseRole)
      : null;
    if (!shiftCode || !role) continue;
    const count =
      typeof obj.count === "number" && obj.count >= 1 ? Math.floor(obj.count) : 1;
    const date =
      typeof obj.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.date)
        ? obj.date
        : todayIso;
    const notes =
      typeof obj.notes === "string" && obj.notes.length > 0
        ? obj.notes
        : undefined;
    result.push({ date, shiftCode, role, count, notes });
  }
  return result;
};

export const parseFacilitySms = async (
  text: string,
  facility: Facility,
  todayIso: string,
  context: ParseContext = {},
): Promise<ParsedFacilityIntent> => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { action: "reply", text: "" };

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
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: TOOLS as any,
    messages: [{ role: "user", content: userParts.join("\n") }],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    const txt = message.content.find((c) => c.type === "text");
    return {
      action: "reply",
      text: txt && txt.type === "text" ? txt.text : "",
    };
  }

  const input = toolUse.input as Record<string, unknown>;

  if (toolUse.name === "create_shifts") {
    const shifts = sanitizeShiftArray(input.shifts, todayIso);
    if (shifts.length === 0) {
      return {
        action: "reply",
        text: "Got your message — could you specify role and shift? e.g. '1 CNA NOC tonight'.",
      };
    }
    return { action: "request", shifts };
  }

  if (toolUse.name === "modify_shifts") {
    const shifts = sanitizeShiftArray(input.replacements, todayIso);
    if (shifts.length === 0) {
      return {
        action: "reply",
        text: "Got it — could you specify role and shift for the change?",
      };
    }
    return {
      action: "modify",
      shifts,
      details:
        typeof input.details === "string" && input.details.length > 0
          ? input.details
          : undefined,
    };
  }

  if (toolUse.name === "cancel_shifts") {
    return {
      action: "cancel",
      scope: input.scope === "specific" ? "specific" : "all",
      details:
        typeof input.details === "string" && input.details.length > 0
          ? input.details
          : undefined,
    };
  }

  if (toolUse.name === "reply_only") {
    return {
      action: "reply",
      text: typeof input.text === "string" ? input.text : "",
    };
  }

  return { action: "reply", text: "" };
};
