import type { Message, Person } from "./db";
import {
  calculateStreaks,
  countWords,
  sortMessagesByTimestamp,
} from "./conversationMetrics";
import {
  dateFromMessage,
  dateKeyFromMessage,
  gapHoursBetweenMessages,
} from "./datetime";
import { isMediaPlaceholder } from "./messageClassification";

export type DateRange = {
  start: string;
  end: string;
};

export const filterMessagesByDateRange = (
  messages: Message[],
  range: DateRange | null,
): Message[] => {
  if (!range?.start && !range?.end) return messages;

  return messages.filter((message) => {
    const key = dateKeyFromMessage(message);
    return (
      (!range.start || key >= range.start) && (!range.end || key <= range.end)
    );
  });
};

export const createStableAliases = (persons: Person[]): Map<number, string> =>
  new Map(
    [...persons]
      .sort((a, b) => a.id - b.id)
      .map((person, index) => [person.id, `Person ${index + 1}`]),
  );

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

export const buildDashboardSummary = (
  messages: Message[],
  persons: Person[],
) => {
  const sorted = sortMessagesByTimestamp(messages);
  const countsByDay = new Map<string, number>();
  const countsByHour = Array(24).fill(0) as number[];
  const countsByPerson = new Map(persons.map((person) => [person.id, 0]));
  const responseMinutes: number[] = [];
  let mediaMessages = 0;
  let words = 0;

  sorted.forEach((message, index) => {
    const day = dateKeyFromMessage(message);
    const date = dateFromMessage(message);
    countsByDay.set(day, (countsByDay.get(day) || 0) + 1);
    if (date) countsByHour[date.getHours()] += 1;
    countsByPerson.set(
      message.personId,
      (countsByPerson.get(message.personId) || 0) + 1,
    );
    if (isMediaPlaceholder(message.text)) mediaMessages += 1;
    words += countWords(message.text);

    const previous = sorted[index - 1];
    if (previous && previous.personId !== message.personId) {
      const gap = gapHoursBetweenMessages(previous, message);
      if (gap !== null && gap > 0 && gap <= 4) responseMinutes.push(gap * 60);
    }
  });

  const busiestDay = [...countsByDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiestHourCount = Math.max(0, ...countsByHour);
  const busiestHour = busiestHourCount
    ? countsByHour.findIndex((count) => count === busiestHourCount)
    : null;
  const mostActive = [...countsByPerson.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const activePerson = persons.find((person) => person.id === mostActive?.[0]);
  const streaks = calculateStreaks(messages);

  return {
    messages: messages.length,
    words,
    activeDays: countsByDay.size,
    messagesPerActiveDay:
      countsByDay.size > 0 ? messages.length / countsByDay.size : 0,
    busiestDay: busiestDay
      ? { date: busiestDay[0], count: busiestDay[1] }
      : null,
    busiestHour:
      busiestHour === null
        ? null
        : { hour: busiestHour, count: busiestHourCount },
    mostActivePerson: activePerson
      ? { name: activePerson.name, count: mostActive?.[1] ?? 0 }
      : null,
    medianResponseMinutes: median(responseMinutes),
    mediaShare: messages.length > 0 ? mediaMessages / messages.length : 0,
    longestActiveStreak: streaks?.activeDayStreak.length ?? 0,
  };
};

export const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return "n/a";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};
