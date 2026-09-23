import { ReportCategory, ReportStatus, ReportUrgency } from '@prisma/client';

// Compound service policy: which team answers each kind of call, and how long
// it has to respond. Reports are routed with these rules rather than with a
// value the client sends, so the confirmation screen shows what the compound
// actually committed to.
const CATEGORY_ROUTING: Record<
  ReportCategory,
  { team: string; baseResponseHours: number }
> = {
  office_equipment: { team: 'אחזקת מבנים', baseResponseHours: 24 },
  air_conditioning: { team: 'מיזוג ואקלים', baseResponseHours: 12 },
  lighting: { team: 'חשמל ותאורה', baseResponseHours: 12 },
  electricity: { team: 'חשמל ותאורה', baseResponseHours: 8 },
  plumbing: { team: 'אינסטלציה', baseResponseHours: 8 },
  network: { team: 'תקשוב', baseResponseHours: 6 },
  furniture: { team: 'אחזקת מבנים', baseResponseHours: 48 },
  cleaning: { team: 'שירותי ניקיון', baseResponseHours: 12 },
  other: { team: 'מוקד המתחם', baseResponseHours: 24 },
};

const URGENCY_FACTOR: Record<ReportUrgency, number> = {
  high: 0.25,
  medium: 1,
  low: 2,
};

export interface ReportRouting {
  assignedTeam: string;
  expectedResponseHours: number;
}

export function routeReport(
  category: ReportCategory,
  urgency: ReportUrgency,
): ReportRouting {
  const routing = CATEGORY_ROUTING[category] ?? CATEGORY_ROUTING.other;
  const hours = Math.max(
    1,
    Math.round(routing.baseResponseHours * URGENCY_FACTOR[urgency]),
  );
  return { assignedTeam: routing.team, expectedResponseHours: hours };
}

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  office_equipment: 'ציוד משרדי',
  air_conditioning: 'מיזוג אוויר',
  lighting: 'תאורה',
  electricity: 'חשמל',
  plumbing: 'אינסטלציה',
  network: 'תקשוב',
  furniture: 'ריהוט',
  cleaning: 'ניקיון',
  other: 'אחר',
};

export const REPORT_URGENCY_LABELS: Record<ReportUrgency, string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'נפתחה קריאה',
  assigned: 'שויך גורם מטפל',
  in_progress: 'בטיפול',
  resolved: 'טופל',
};

// The compound's working window. Occupancy is measured against it, and the
// booking screen offers slots inside it.
export const WORKING_HOURS = { start: 8, end: 18 } as const;
export const WORKING_DAYS = [0, 1, 2, 3, 4] as const; // Sunday–Thursday

const JERUSALEM_TIME_ZONE = 'Asia/Jerusalem';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: JERUSALEM_TIME_ZONE,
  weekday: 'short',
  hour: 'numeric',
  hour12: false,
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Analytics are reported in compound-local time: a booking at 09:00 belongs in
// the 09:00 column whatever the server's own timezone is.
export function localDayAndHour(date: Date): { day: number; hour: number } {
  const parts = partsFormatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const hourValue = parts.find((part) => part.type === 'hour')?.value ?? '0';
  return {
    day: WEEKDAY_INDEX[weekday] ?? 0,
    hour: Number(hourValue) % 24,
  };
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}
