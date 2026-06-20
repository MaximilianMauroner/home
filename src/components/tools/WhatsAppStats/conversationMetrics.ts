import type { Message, Person } from "./db";
import {
  compareMessagesByTimestamp,
  dateFromMessage,
  dateKeyFromMessage,
  gapHoursBetweenMessages,
  isDifferentCalendarDay,
} from "./datetime";
import { EMOJI_PATTERN } from "./Graphs/utils";
import { isTextualMessage } from "./messageClassification";

export const CONVERSATION_RESTART_GAP_HOURS = 4;
export const CROSS_DAY_RESTART_GAP_HOURS = 1;

export interface ConversationThread {
  messages: Message[];
  gapFromPreviousHours: number | null;
}

export interface ConversationRestart {
  previous: Message;
  current: Message;
  gapHours: number;
}

export const sortMessagesByTimestamp = (messages: Message[]): Message[] =>
  [...messages].sort(compareMessagesByTimestamp);

export const getConversationRestartGap = (
  previous: Pick<Message, "date" | "time">,
  current: Pick<Message, "date" | "time">,
): number | null => {
  const gapHours = gapHoursBetweenMessages(previous, current);
  if (gapHours === null || gapHours <= 0) return null;

  const crossedDay = isDifferentCalendarDay(previous, current);
  return gapHours > CONVERSATION_RESTART_GAP_HOURS ||
    (crossedDay && gapHours > CROSS_DAY_RESTART_GAP_HOURS)
    ? gapHours
    : null;
};

export const splitConversationThreads = (
  messages: Message[],
): ConversationThread[] => {
  const sortedMessages = sortMessagesByTimestamp(messages);
  if (sortedMessages.length === 0) return [];

  const threads: ConversationThread[] = [
    { messages: [sortedMessages[0]], gapFromPreviousHours: null },
  ];

  for (let index = 1; index < sortedMessages.length; index++) {
    const previous = sortedMessages[index - 1];
    const current = sortedMessages[index];
    const restartGap = getConversationRestartGap(previous, current);

    if (restartGap !== null) {
      threads.push({ messages: [current], gapFromPreviousHours: restartGap });
    } else {
      threads[threads.length - 1].messages.push(current);
    }
  }

  return threads;
};

export const getConversationRestarts = (
  messages: Message[],
): ConversationRestart[] => {
  const sortedMessages = sortMessagesByTimestamp(messages);
  const restarts: ConversationRestart[] = [];

  for (let index = 1; index < sortedMessages.length; index++) {
    const previous = sortedMessages[index - 1];
    const current = sortedMessages[index];
    const gapHours = getConversationRestartGap(previous, current);
    if (gapHours !== null) {
      restarts.push({ previous, current, gapHours });
    }
  }

  return restarts;
};

export const countWords = (text: string): number => {
  if (!isTextualMessage(text)) return 0;
  const words = text.replace(EMOJI_PATTERN, "").trim().split(/\s+/);
  return words.filter(Boolean).length;
};

export const formatHours = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};

const personNameById = (persons: Person[]): Map<number, string> =>
  new Map(persons.map((person) => [person.id, person.name]));

export const calculateNormalizedShares = (
  messages: Message[],
  persons: Person[],
) => {
  const totalsByPerson = new Map<
    number,
    { messages: number; words: number; activeDays: Set<string> }
  >();

  for (const person of persons) {
    totalsByPerson.set(person.id, {
      messages: 0,
      words: 0,
      activeDays: new Set(),
    });
  }

  let totalMessages = 0;
  let totalWords = 0;

  for (const message of messages) {
    const personTotals = totalsByPerson.get(message.personId);
    if (!personTotals) continue;

    const words = countWords(message.text);
    totalMessages += 1;
    totalWords += words;
    personTotals.messages += 1;
    personTotals.words += words;
    personTotals.activeDays.add(dateKeyFromMessage(message));
  }

  return persons.map((person) => {
    const totals = totalsByPerson.get(person.id)!;
    const activeDays = totals.activeDays.size;
    return {
      personId: person.id,
      name: person.name,
      messages: totals.messages,
      messageShare: totalMessages > 0 ? totals.messages / totalMessages : 0,
      words: totals.words,
      wordShare: totalWords > 0 ? totals.words / totalWords : 0,
      activeDays,
      messagesPerActiveDay:
        activeDays > 0 ? totals.messages / activeDays : totals.messages,
      wordsPerActiveDay: activeDays > 0 ? totals.words / activeDays : 0,
    };
  });
};

export const calculateReciprocity = (
  messages: Message[],
  persons: Person[],
) => {
  const sortedMessages = sortMessagesByTimestamp(messages);
  const names = personNameById(persons);
  const directedReplies = new Map<string, number>();
  let totalReplies = 0;

  for (let index = 1; index < sortedMessages.length; index++) {
    const previous = sortedMessages[index - 1];
    const current = sortedMessages[index];

    if (previous.personId === current.personId) continue;
    if (getConversationRestartGap(previous, current) !== null) continue;

    const key = `${previous.personId}:${current.personId}`;
    directedReplies.set(key, (directedReplies.get(key) || 0) + 1);
    totalReplies += 1;
  }

  const pairStats = [];
  for (let firstIndex = 0; firstIndex < persons.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < persons.length;
      secondIndex++
    ) {
      const first = persons[firstIndex];
      const second = persons[secondIndex];
      const firstAfterSecond =
        directedReplies.get(`${second.id}:${first.id}`) || 0;
      const secondAfterFirst =
        directedReplies.get(`${first.id}:${second.id}`) || 0;
      const total = firstAfterSecond + secondAfterFirst;
      if (total === 0) continue;

      const larger = Math.max(firstAfterSecond, secondAfterFirst);
      const smaller = Math.min(firstAfterSecond, secondAfterFirst);

      pairStats.push({
        firstPersonId: first.id,
        firstName: names.get(first.id) || first.name,
        secondPersonId: second.id,
        secondName: names.get(second.id) || second.name,
        firstAfterSecond,
        secondAfterFirst,
        total,
        balance: larger > 0 ? smaller / larger : 0,
      });
    }
  }

  return {
    totalReplies,
    pairStats: pairStats.sort((a, b) => b.total - a.total),
  };
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const calculateWeekdayHourMatrix = (messages: Message[]) => {
  const matrix = WEEKDAY_LABELS.map(() => Array(24).fill(0) as number[]);

  for (const message of messages) {
    const date = dateFromMessage(message);
    if (!date) continue;
    const mondayFirstWeekday = (date.getDay() + 6) % 7;
    matrix[mondayFirstWeekday][date.getHours()] += 1;
  }

  let maxCount = 0;
  let busiest: { weekday: string; hour: number; count: number } | null = null;

  matrix.forEach((hours, weekdayIndex) => {
    hours.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        busiest = {
          weekday: WEEKDAY_LABELS[weekdayIndex],
          hour,
          count,
        };
      }
    });
  });

  return { matrix, maxCount, busiest };
};

export const calculateStreaks = (messages: Message[]) => {
  const sortedMessages = sortMessagesByTimestamp(messages);
  if (sortedMessages.length === 0) return null;

  const firstDate = dateFromMessage(sortedMessages[0]);
  const lastDate = dateFromMessage(sortedMessages[sortedMessages.length - 1]);
  if (!firstDate || !lastDate) return null;

  const activeDateKeys = new Set(
    sortedMessages.map((message) => dateKeyFromMessage(message)),
  );
  const allDates: string[] = [];
  const current = new Date(
    firstDate.getFullYear(),
    firstDate.getMonth(),
    firstDate.getDate(),
  );
  const end = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate(),
  );

  while (current <= end) {
    allDates.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(current.getDate()).padStart(2, "0")}`,
    );
    current.setDate(current.getDate() + 1);
  }

  const findLongestDayStreak = (targetActive: boolean) => {
    let best = { length: 0, start: "", end: "" };
    let currentStart = "";
    let currentLength = 0;

    for (const dateKey of allDates) {
      const matches = activeDateKeys.has(dateKey) === targetActive;
      if (matches) {
        if (currentLength === 0) currentStart = dateKey;
        currentLength += 1;
        if (currentLength > best.length) {
          best = {
            length: currentLength,
            start: currentStart,
            end: dateKey,
          };
        }
      } else {
        currentLength = 0;
        currentStart = "";
      }
    }

    return best;
  };

  let longestGap = {
    hours: 0,
    from: sortedMessages[0],
    to: sortedMessages[0],
  };

  for (let index = 1; index < sortedMessages.length; index++) {
    const previous = sortedMessages[index - 1];
    const currentMessage = sortedMessages[index];
    const gapHours = gapHoursBetweenMessages(previous, currentMessage);
    if (gapHours !== null && gapHours > longestGap.hours) {
      longestGap = { hours: gapHours, from: previous, to: currentMessage };
    }
  }

  return {
    activeDayStreak: findLongestDayStreak(true),
    silentDayStreak: findLongestDayStreak(false),
    longestGap,
  };
};

export const calculateReviverStats = (
  messages: Message[],
  persons: Person[],
) => {
  const restarts = getConversationRestarts(messages);
  const revivalsByPerson = new Map<number, number>();

  for (const restart of restarts) {
    revivalsByPerson.set(
      restart.current.personId,
      (revivalsByPerson.get(restart.current.personId) || 0) + 1,
    );
  }

  const totalRevivals = restarts.length;

  return {
    totalRevivals,
    revivers: persons
      .map((person) => {
        const revivals = revivalsByPerson.get(person.id) || 0;
        return {
          personId: person.id,
          name: person.name,
          revivals,
          share: totalRevivals > 0 ? revivals / totalRevivals : 0,
        };
      })
      .filter((stat) => stat.revivals > 0)
      .sort((a, b) => b.revivals - a.revivals),
  };
};
