import type { Message } from "./db";

interface DateParts {
  day: number;
  month: number;
  year: number;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

const fullYear = (year: number): number => {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
};

const isValidDate = ({ day, month, year }: DateParts): boolean => {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const flexibleDateParts = (datePart: string): DateParts | null => {
  const match = datePart.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = fullYear(Number(match[3]));

  const candidates: DateParts[] = [];
  if (first > 12 && second <= 12) {
    candidates.push({ day: first, month: second, year });
  } else if (second > 12 && first <= 12) {
    candidates.push({ day: second, month: first, year });
  } else {
    // Ambiguous exports are treated as day-first, matching the original tool
    // and most non-US WhatsApp exports.
    candidates.push({ day: first, month: second, year });
    candidates.push({ day: second, month: first, year });
  }

  return candidates.find(isValidDate) ?? null;
};

const normalizeTime = (timePart: string): string | null => {
  const match = timePart
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  const meridiem = match[4]?.toLowerCase().replace(/\./g, "");

  if (minute > 59 || second > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (meridiem === "pm" && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }

  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
};

export const normalizeExportDateTime = (
  datePart: string,
  timePart: string,
): { date: string; time: string; year: number } | null => {
  const date = flexibleDateParts(datePart);
  const time = normalizeTime(timePart);
  if (!date || !time) return null;

  return {
    date: `${pad2(date.day)}/${pad2(date.month)}/${date.year}`,
    time,
    year: date.year,
  };
};

const parseStoredDateParts = (dateString: string): DateParts | null => {
  const parts = dateString.split("/").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return flexibleDateParts(dateString);
  }

  const canonical = {
    day: parts[0],
    month: parts[1],
    year: fullYear(parts[2]),
  };
  if (isValidDate(canonical)) return canonical;

  return flexibleDateParts(dateString);
};

const dateKeyFromParts = ({ day, month, year }: DateParts): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

export const dateKeyFromMessage = (message: Pick<Message, "date">): string => {
  const parts = parseStoredDateParts(message.date);
  return parts ? dateKeyFromParts(parts) : message.date;
};

export const dateFromMessage = (
  message: Pick<Message, "date" | "time">,
): Date | null => {
  const parts = parseStoredDateParts(message.date);
  const time = normalizeTime(message.time);
  if (!parts || !time) return null;

  const [hour, minute, second] = time.split(":").map(Number);
  return new Date(parts.year, parts.month - 1, parts.day, hour, minute, second);
};

export const compareMessagesByTimestamp = (
  a: Pick<Message, "date" | "time" | "id">,
  b: Pick<Message, "date" | "time" | "id">,
): number => {
  const aDate = dateFromMessage(a);
  const bDate = dateFromMessage(b);

  if (aDate && bDate) {
    const diff = aDate.getTime() - bDate.getTime();
    if (diff !== 0) return diff;
  } else if (aDate) {
    return -1;
  } else if (bDate) {
    return 1;
  }

  return (a.id ?? 0) - (b.id ?? 0);
};

export const gapHoursBetweenMessages = (
  previous: Pick<Message, "date" | "time">,
  current: Pick<Message, "date" | "time">,
): number | null => {
  const previousDate = dateFromMessage(previous);
  const currentDate = dateFromMessage(current);
  if (!previousDate || !currentDate) return null;
  return (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60);
};

export const isDifferentCalendarDay = (
  previous: Pick<Message, "date">,
  current: Pick<Message, "date">,
): boolean => dateKeyFromMessage(previous) !== dateKeyFromMessage(current);

export const enumerateDateKeys = (start: Date, end: Date): string[] => {
  const keys: string[] = [];
  const current = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (current <= last) {
    keys.push(
      dateKeyFromParts({
        day: current.getDate(),
        month: current.getMonth() + 1,
        year: current.getFullYear(),
      }),
    );
    current.setDate(current.getDate() + 1);
  }

  return keys;
};

export const hourFromTime = (timePart: string): number | null => {
  const normalized = normalizeTime(timePart);
  if (!normalized) return null;
  return Number(normalized.split(":")[0]);
};
