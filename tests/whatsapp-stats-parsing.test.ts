import { describe, expect, test } from "vitest";

import {
  dateKeyFromMessage,
  gapHoursBetweenMessages,
  normalizeExportDateTime,
} from "../src/components/tools/WhatsAppStats/datetime";
import { parseChat } from "../src/components/tools/WhatsAppStats/parsing";

describe("WhatsApp stats parsing", () => {
  test("parses Android exports with two-digit years", () => {
    const parsed = parseChat(
      [
        "31/12/24, 23:59 - Alice: happy new year soon",
        "01/01/25, 00:05 - Bob: happy new year",
      ].join("\n"),
    );

    expect(parsed.participants).toEqual(["Alice", "Bob"]);
    expect(parsed.messages).toMatchObject([
      {
        user: "Alice",
        date: "31/12/2024",
        time: "23:59:00",
        year: 2024,
      },
      {
        user: "Bob",
        date: "01/01/2025",
        time: "00:05:00",
        year: 2025,
      },
    ]);
  });

  test("normalizes month-first AM/PM exports when the date is unambiguous", () => {
    const parsed = parseChat("12/31/2024, 11:59 PM - Alice: midnight is close");

    expect(parsed.messages).toMatchObject([
      {
        user: "Alice",
        date: "31/12/2024",
        time: "23:59:00",
        year: 2024,
      },
    ]);
  });

  test("does not drop real user text that resembles a system message", () => {
    const parsed = parseChat(
      "31/12/24, 09:00 - Alice: the event was added to the calendar",
    );

    expect(parsed.participants).toEqual(["Alice"]);
    expect(parsed.messages[0].text).toBe("the event was added to the calendar");
  });

  test("does not attach timestamped system lines to neighboring messages", () => {
    const parsed = parseChat(
      [
        "31/12/24, 09:00 - Alice: first",
        "31/12/24, 09:01 - Messages and calls are end-to-end encrypted.",
        "31/12/24, 09:02 - Bob: second",
      ].join("\n"),
    );

    expect(parsed.messages.map((message) => message.text)).toEqual([
      "first",
      "second",
    ]);
  });

  test("keeps internal blank lines in multiline messages", () => {
    const parsed = parseChat(
      ["31/12/24, 09:00 - Alice: line one", "", "line three"].join("\n"),
    );

    expect(parsed.messages[0].text).toBe("line one\n\nline three");
  });

  test("builds local date keys without UTC day shifts", () => {
    expect(dateKeyFromMessage({ date: "01/01/2025" })).toBe("2025-01-01");
  });

  test("computes gaps from normalized 24-hour timestamps", () => {
    const previous = normalizeExportDateTime("12/31/2024", "11:30 PM");
    const current = normalizeExportDateTime("01/01/2025", "12:15 AM");

    expect(previous).not.toBeNull();
    expect(current).not.toBeNull();
    expect(gapHoursBetweenMessages(previous!, current!)).toBeCloseTo(0.75);
  });
});
