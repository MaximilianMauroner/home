import { describe, expect, test } from "vitest";

import type { Message, Person } from "../src/components/tools/WhatsAppStats/db";
import {
  calculateNormalizedShares,
  calculateReciprocity,
  calculateStreaks,
  calculateWeekdayHourMatrix,
  getConversationRestarts,
  splitConversationThreads,
} from "../src/components/tools/WhatsAppStats/conversationMetrics";

const people: Person[] = [
  { id: 1, chatId: 1, name: "Alice" },
  { id: 2, chatId: 1, name: "Bob" },
];

const message = (
  id: number,
  personId: number,
  date: string,
  time: string,
  text = "hello there",
): Message => ({
  id,
  personId,
  chatId: 1,
  date,
  time,
  year: Number(date.split("/")[2]),
  text,
});

describe("WhatsApp stats metrics", () => {
  test("splits threads and restarts using the shared threshold", () => {
    const messages = [
      message(1, 1, "01/01/2025", "09:00:00"),
      message(2, 2, "01/01/2025", "09:05:00"),
      message(3, 1, "01/01/2025", "14:10:00"),
      message(4, 2, "02/01/2025", "00:20:00"),
      message(5, 1, "02/01/2025", "00:40:00"),
    ];

    expect(
      splitConversationThreads(messages).map((thread) => thread.messages),
    ).toHaveLength(3);
    expect(
      getConversationRestarts(messages).map((restart) =>
        Number(restart.gapHours.toFixed(2)),
      ),
    ).toEqual([5.08, 10.17]);
  });

  test("calculates reciprocity only from in-thread cross-person replies", () => {
    const messages = [
      message(1, 1, "01/01/2025", "09:00:00"),
      message(2, 2, "01/01/2025", "09:05:00"),
      message(3, 1, "01/01/2025", "09:10:00"),
      message(4, 1, "01/01/2025", "09:15:00"),
      message(5, 2, "01/01/2025", "14:30:00"),
    ];

    const reciprocity = calculateReciprocity(messages, people);

    expect(reciprocity.totalReplies).toBe(2);
    expect(reciprocity.pairStats[0]).toMatchObject({
      firstAfterSecond: 1,
      secondAfterFirst: 1,
      balance: 1,
    });
  });

  test("places messages in the weekday/hour heatmap using local dates", () => {
    const messages = [
      message(1, 1, "06/01/2025", "09:00:00"),
      message(2, 2, "06/01/2025", "09:30:00"),
      message(3, 1, "07/01/2025", "22:00:00"),
    ];

    const heatmap = calculateWeekdayHourMatrix(messages);

    expect(heatmap.matrix[0][9]).toBe(2);
    expect(heatmap.matrix[1][22]).toBe(1);
    expect(heatmap.busiest).toEqual({ weekday: "Mon", hour: 9, count: 2 });
  });

  test("calculates active and silent day streaks across zero-message days", () => {
    const messages = [
      message(1, 1, "01/01/2025", "09:00:00"),
      message(2, 2, "02/01/2025", "09:00:00"),
      message(3, 1, "05/01/2025", "09:00:00"),
      message(4, 2, "06/01/2025", "09:00:00"),
      message(5, 1, "07/01/2025", "09:00:00"),
    ];

    const streaks = calculateStreaks(messages);

    expect(streaks?.activeDayStreak).toEqual({
      length: 3,
      start: "2025-01-05",
      end: "2025-01-07",
    });
    expect(streaks?.silentDayStreak).toEqual({
      length: 2,
      start: "2025-01-03",
      end: "2025-01-04",
    });
  });

  test("normalizes participant shares by active days", () => {
    const messages = [
      message(1, 1, "01/01/2025", "09:00:00", "one two"),
      message(2, 1, "01/01/2025", "09:05:00", "three"),
      message(3, 2, "02/01/2025", "09:00:00", "four five six"),
      message(4, 2, "03/01/2025", "09:00:00", "<Media omitted>"),
    ];

    const shares = calculateNormalizedShares(messages, people);

    expect(shares).toMatchObject([
      {
        name: "Alice",
        messages: 2,
        words: 3,
        activeDays: 1,
        messagesPerActiveDay: 2,
      },
      {
        name: "Bob",
        messages: 2,
        words: 3,
        activeDays: 2,
        messagesPerActiveDay: 1,
      },
    ]);
  });
});
