import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Facility, ParsedShiftRequest, ShiftCode, NurseRole } from "@/types";

const VALID_CODES: ShiftCode[] = ["AM", "PM", "NOC"];
const VALID_ROLES: NurseRole[] = ["RN", "LPN", "CNA", "NP"];

const SYSTEM_PROMPT = `You parse staffing requests for a nursing registry.
Return STRICT JSON matching this TypeScript type, with no prose:

{
  "date": "YYYY-MM-DD",            // ISO date in the facility's local timezone
  "shiftCode": "AM" | "PM" | "NOC",// AM=morning, PM=afternoon/evening, NOC=overnight
  "role": "RN" | "LPN" | "CNA" | "NP",
  "count": number,                 // number of clinicians needed (default 1)
  "notes": string | null
}

Rules:
- "tonight" / "overnight" / "graveyard" → NOC
- "morning" / "day" / "AM" → AM; "evening" / "PM" / "afternoon" → PM
- If role is ambiguous, default to "CNA".
- If date is missing, use the upcoming day matching the request.
- Output only valid JSON, no code fences.`;

export const parseShiftRequest = async (
  text: string,
  facility: Facility,
  todayIso: string,
): Promise<ParsedShiftRequest> => {
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
        content: `Today is ${todayIso}. Facility: ${facility.name} (${facility.city}, ${facility.state}).\n\nIncoming SMS:\n"""\n${text}\n"""`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  let parsed: ParsedShiftRequest;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI parser returned non-JSON: ${raw.slice(0, 200)}`);
  }

  if (!VALID_CODES.includes(parsed.shiftCode)) parsed.shiftCode = "AM";
  if (!VALID_ROLES.includes(parsed.role)) parsed.role = "CNA";
  if (!parsed.count || parsed.count < 1) parsed.count = 1;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) parsed.date = todayIso;

  return parsed;
};
