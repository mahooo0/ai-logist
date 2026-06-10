import { addDays, format, startOfMonth } from "date-fns";

import type { CalendarEvent } from "./event-types";

function id() {
  return Math.random().toString(36).slice(2, 10);
}

export function buildSeedEvents(reference: Date): CalendarEvent[] {
  const monthStart = startOfMonth(reference);
  const day = (offset: number) => format(addDays(monthStart, offset), "yyyy-MM-dd");

  return [
    { id: id(), title: "Team Standup", date: day(1), color: "green" },
    { id: id(), title: "Sprint Review", date: day(3), color: "green" },
    { id: id(), title: "Client Call — Acme Corp", date: day(5), color: "amber" },
    { id: id(), title: "Design Review", date: day(5), color: "slate" },
    { id: id(), title: "Product Launch", date: day(9), color: "rose" },
    { id: id(), title: "Lunch & Learn", date: day(11), color: "green" },
    { id: id(), title: "Budget Meeting", date: day(12), color: "amber" },
    { id: id(), title: "1:1 with Manager", date: day(13), color: "slate" },
    { id: id(), title: "Team Standup", date: day(16), color: "green" },
    { id: id(), title: "Sprint Planning", date: day(17), color: "green" },
    { id: id(), title: "Stakeholder Demo", date: day(17), color: "amber" },
    { id: id(), title: "Security Audit", date: day(19), color: "rose" },
    { id: id(), title: "UX Workshop", date: day(21), color: "green" },
    { id: id(), title: "Client Call — Globex", date: day(23), color: "amber" },
    { id: id(), title: "Code Freeze", date: day(25), color: "rose" },
    { id: id(), title: "Team Retrospective", date: day(26), color: "slate" },
    { id: id(), title: "Q1 Review", date: day(32), color: "green" },
    { id: id(), title: "Conference Travel", date: day(35), color: "amber" },
  ];
}
