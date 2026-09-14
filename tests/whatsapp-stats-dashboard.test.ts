import { describe, expect, test } from "vitest";

import type { Message, Person } from "../src/components/tools/WhatsAppStats/db";
import {
  buildDashboardSummary,
  createStableAliases,
  filterMessagesByDateRange,
} from "../src/components/tools/WhatsAppStats/dashboardMetrics";

const people: Person[] = [
  { id: 8, chatId: 1, name: "Bob" },
  { id: 3, chatId: 1, name: "Alice" },
];

const message = (
  id: number,
  personId: number,
  date: string,
  time: string,
  text = "hello there",
): Message => ({ id, personId, chatId: 1, date, time, year: 2025, text });

const messages = [
  message(1, 3, "01/01/2025", "09:00:00"),
  message(2, 8, "01/01/2025", "09:30:00"),
  message(3, 3, "02/01/2025", "09:00:00", "<Media omitted>"),
  message(4, 3, "03/01/2025", "11:00:00"),
];

describe("WhatsApp dashboard helpers", () => {
  test("filters inclusively by local calendar date", () => {
    expect(
      filterMessagesByDateRange(messages, {
        start: "2025-01-02",
        end: "2025-01-03",
      }).map((entry) => entry.id),
    ).toEqual([3, 4]);
  });

  test("keeps anonymized aliases stable by participant id", () => {
    const aliases = createStableAliases(people);

    expect(aliases.get(3)).toBe("Person 1");
    expect(aliases.get(8)).toBe("Person 2");
  });

  test("builds scannable aggregate highlights", () => {
    const summary = buildDashboardSummary(messages, people);

    expect(summary.messages).toBe(4);
    expect(summary.activeDays).toBe(3);
    expect(summary.messagesPerActiveDay).toBeCloseTo(4 / 3);
    expect(summary.busiestDay).toEqual({ date: "2025-01-01", count: 2 });
    expect(summary.busiestHour).toEqual({ hour: 9, count: 3 });
    expect(summary.mostActivePerson).toEqual({ name: "Alice", count: 3 });
    expect(summary.medianResponseMinutes).toBe(30);
    expect(summary.mediaShare).toBe(0.25);
    expect(summary.longestActiveStreak).toBe(3);
  });
});
