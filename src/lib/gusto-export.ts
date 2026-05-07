import "server-only";
import type { Timesheet } from "@/types";

const escape = (val: string) => {
  if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
};

export const buildGustoCSV = (timesheets: Timesheet[]): string => {
  const header = [
    "First Name",
    "Last Name",
    "Date",
    "Hours",
    "Pay Rate",
    "Facility",
    "Notes",
  ];
  const rows = [header.join(",")];
  for (const t of timesheets) {
    if (!t.totalHours || !t.clockIn) continue;
    const [first, ...rest] = t.nurseName.split(" ");
    const last = rest.join(" ");
    const date = t.clockIn.toDate().toISOString().slice(0, 10);
    rows.push(
      [
        escape(first ?? ""),
        escape(last),
        date,
        t.totalHours.toFixed(2),
        "",
        escape(t.facilityName),
        escape(t.notes ?? ""),
      ].join(","),
    );
  }
  return rows.join("\n");
};
