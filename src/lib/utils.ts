import clsx, { ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const formatCurrency = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

// Shift timestamps are stored as wall-clock time in UTC (a 7am AM shift becomes
// 07:00:00Z) so the displayed hours match what the facility configured no matter
// where the code runs. Always read shift hours via these helpers, never .getHours().
export const padTime = (t: string) => {
  const [h, m] = t.split(":");
  return `${(h ?? "00").padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
};

export const buildShiftDate = (
  isoDate: string,
  hhmm: string,
): Date => new Date(`${isoDate}T${padTime(hhmm)}:00.000Z`);

export const formatShiftHour = (d: Date): string => {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "p" : "a";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
};

export const formatShiftDateLabel = (d: Date): string =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// Today's date as YYYY-MM-DD in the *browser's* local timezone. Use on the
// client wherever we need a date input default — never use the UTC-based
// new Date().toISOString().slice(0, 10), which silently rolls over to
// tomorrow late evening on the West Coast.
export const todayLocal = (): string => {
  // en-CA's short format happens to be ISO YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA");
};

// Today's date YYYY-MM-DD in the given IANA timezone. Used server-side to
// give the AI parser the right "today" relative to the facility, not the
// Vercel runtime (which is UTC).
export const todayInTimezone = (tz: string): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

// Coarse state -> IANA timezone mapping for US facilities. Picks the
// dominant TZ for split states (FL, IN, KY, MI, ND, SD, TN, NE, KS, OR, ID).
// AZ doesn't observe DST.
const STATE_TIMEZONES: Record<string, string> = {
  CA: "America/Los_Angeles",
  WA: "America/Los_Angeles",
  OR: "America/Los_Angeles",
  NV: "America/Los_Angeles",

  AZ: "America/Phoenix",

  CO: "America/Denver",
  NM: "America/Denver",
  UT: "America/Denver",
  WY: "America/Denver",
  MT: "America/Denver",
  ID: "America/Denver",

  TX: "America/Chicago",
  IL: "America/Chicago",
  WI: "America/Chicago",
  MN: "America/Chicago",
  IA: "America/Chicago",
  MO: "America/Chicago",
  AR: "America/Chicago",
  LA: "America/Chicago",
  OK: "America/Chicago",
  KS: "America/Chicago",
  NE: "America/Chicago",
  SD: "America/Chicago",
  ND: "America/Chicago",
  AL: "America/Chicago",
  MS: "America/Chicago",
  TN: "America/Chicago",

  NY: "America/New_York",
  NJ: "America/New_York",
  CT: "America/New_York",
  MA: "America/New_York",
  RI: "America/New_York",
  NH: "America/New_York",
  VT: "America/New_York",
  ME: "America/New_York",
  PA: "America/New_York",
  DE: "America/New_York",
  MD: "America/New_York",
  DC: "America/New_York",
  VA: "America/New_York",
  WV: "America/New_York",
  OH: "America/New_York",
  MI: "America/New_York",
  KY: "America/New_York",
  NC: "America/New_York",
  SC: "America/New_York",
  GA: "America/New_York",
  FL: "America/New_York",
  IN: "America/New_York",

  AK: "America/Anchorage",
  HI: "Pacific/Honolulu",
};

export const facilityTimezone = (facility: { state?: string }): string => {
  if (facility.state) {
    const tz = STATE_TIMEZONES[facility.state.toUpperCase()];
    if (tz) return tz;
  }
  return "America/Los_Angeles";
};

// Random 192-bit token, hex-encoded. Used as the unguessable secret in
// /f/<token> magic links. Browser-safe.
export const generatePortalToken = (): string => {
  const arr = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
};
