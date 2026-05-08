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
