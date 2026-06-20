import { normalizeExportDateTime } from "./datetime";

// Pure WhatsApp chat-export parsing, extracted so it can run inside a web
// worker (off the main thread) with a synchronous fallback. No DOM / Dexie
// access here — the caller attaches personIds and writes to the database.

export interface ParsedMessage {
  user: string;
  time: string;
  date: string;
  text: string;
  year: number;
}

export interface ParsedChat {
  participants: string[];
  messages: ParsedMessage[];
}

const INVISIBLE_CHARS = /[\u200e\u200f\u202a-\u202e]/g;
const DATE_PATTERN = String.raw`\d{1,2}[./]\d{1,2}[./]\d{2,4}`;
const TIME_PATTERN = String.raw`\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?`;
const BRACKETED_TIMESTAMP = new RegExp(
  String.raw`^\s*[\u200e\u200f]?\[(${DATE_PATTERN}),\s*(${TIME_PATTERN})\]\s+(.+)$`,
  "i",
);
const DASH_TIMESTAMP = new RegExp(
  String.raw`^\s*[\u200e\u200f]?(${DATE_PATTERN}),\s*(${TIME_PATTERN})\s+-\s+(.+)$`,
  "i",
);

interface MessageStart {
  date: string;
  time: string;
  user: string;
  text: string;
  year: number;
}

const splitUserAndText = (
  remainder: string,
): { user: string; text: string } | null => {
  const delimiterIndex = remainder.indexOf(": ");
  if (delimiterIndex === -1) return null;

  const user = remainder
    .slice(0, delimiterIndex)
    .replace(INVISIBLE_CHARS, "")
    .trim();
  const text = remainder.slice(delimiterIndex + 2);

  if (
    !user ||
    user.length >= 100 ||
    user.toLowerCase() === "whatsapp" ||
    user.toLowerCase().includes("system")
  ) {
    return null;
  }

  return { user, text };
};

const parseMessageStart = (line: string): MessageStart | null => {
  const bracketed = line.match(BRACKETED_TIMESTAMP);
  const dashed = line.match(DASH_TIMESTAMP);
  const match = bracketed ?? dashed;
  if (!match) return null;

  const [, datePart, timePart, remainder] = match;
  const normalized = normalizeExportDateTime(datePart, timePart);
  const userAndText = splitUserAndText(remainder);
  if (!normalized || !userAndText) return null;

  return {
    ...normalized,
    ...userAndText,
  };
};

const startsWithTimestamp = (line: string): boolean =>
  BRACKETED_TIMESTAMP.test(line) || DASH_TIMESTAMP.test(line);

const cleanMessageText = (text: string): string =>
  text
    .replace(/\s*<This message was edited>\s*$/i, "")
    .replace(INVISIBLE_CHARS, "")
    .trim();

/** Parse a full chat export into participants and structured messages. */
export const parseChat = (text: string): ParsedChat => {
  const lines = text.split(/\r?\n/);
  const participants = new Set<string>();
  const messages: ParsedMessage[] = [];
  let current: MessageStart | null = null;
  let currentTextLines: string[] = [];

  const flush = () => {
    if (!current) return;

    const fullText = cleanMessageText(currentTextLines.join("\n"));
    if (fullText) {
      participants.add(current.user);
      messages.push({
        user: current.user,
        time: current.time,
        date: current.date,
        text: fullText,
        year: current.year,
      });
    }

    current = null;
    currentTextLines = [];
  };

  for (const line of lines) {
    const start = parseMessageStart(line);
    if (start) {
      flush();
      current = start;
      currentTextLines = [start.text];
      continue;
    }

    if (startsWithTimestamp(line)) {
      flush();
      continue;
    }

    if (current) {
      currentTextLines.push(line);
    }
  }

  flush();

  return { participants: Array.from(participants), messages };
};
