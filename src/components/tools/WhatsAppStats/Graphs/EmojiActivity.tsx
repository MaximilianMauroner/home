import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors, EMOJI_PATTERN } from "./utils";

export const EmojiActivity = ({ messages, persons }: GraphProps) => {
  const emojiCounts = useMemo(() => {
    const emojiMap = new Map<string, number>();
    const emojiPerPerson: Record<string, Record<number, number>> = {};

    messages.forEach((msg) => {
      const emojis = msg.text.match(EMOJI_PATTERN);
      if (emojis) {
        emojis.forEach((emoji) => {
          // Skip if the emoji is a number (e.g., "1", "2", etc.)
          if (!isNaN(Number(emoji))) return;
          if (
            emoji === "*" ||
            emoji === "️" ||
            emoji === "🏻" ||
            emoji === "🏼"
          )
            return;
          emojiMap.set(emoji, (emojiMap.get(emoji) || 0) + 1);
          if (!emojiPerPerson[emoji]) emojiPerPerson[emoji] = {};
          emojiPerPerson[emoji][msg.personId] =
            (emojiPerPerson[emoji][msg.personId] || 0) + 1;
        });
      }
    });

    // Sort emojis by usage descending (no slice, show all)
    const sorted = Array.from(emojiMap.entries()).sort((a, b) => b[1] - a[1]);
    return { sorted, emojiPerPerson };
  }, [messages]);

  if (emojiCounts.sorted.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
          Emoji Usage
        </h3>
        <p className="text-sm text-muted-foreground">No emojis found.</p>
      </div>
    );
  }

  // Only show the top 30 emojis
  emojiCounts.sorted = emojiCounts.sorted.slice(0, 30);

  // Prepare stacked datasets: one for each person
  const colorMap = getParticipantColors(persons.map((p) => p.name));
  const personColors = persons.map((p) => colorMap[p.name]);
  const data = {
    labels: emojiCounts.sorted.map(([emoji]) => emoji),
    datasets: persons.map((p, idx) => ({
      label: p.name,
      data: emojiCounts.sorted.map(
        ([emoji]) => emojiCounts.emojiPerPerson[emoji]?.[p.id] || 0,
      ),
      backgroundColor: personColors[idx % personColors.length].bg,
      borderColor: personColors[idx % personColors.length].border,
      borderWidth: 1,
      stack: "emojis",
    })),
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
    },
    scales: {
      x: {
        display: true,
        stacked: true,
      },
      y: {
        display: true,
        stacked: true,
      },
    },
  };

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Emoji Usage
      </h3>
      <div className="mb-4 flex flex-col flex-wrap text-sm text-muted-foreground">
        {persons
          .map((p) => {
            let maxEmoji = null;
            let maxCount = 0;
            Object.entries(emojiCounts.emojiPerPerson).forEach(
              ([emoji, perPerson]) => {
                const count = perPerson[p.id] || 0;
                if (count > maxCount) {
                  maxCount = count;
                  maxEmoji = emoji;
                }
              },
            );
            const total = Object.values(emojiCounts.emojiPerPerson).reduce(
              (sum, perPerson) => sum + (perPerson[p.id] || 0),
              0,
            );
            return {
              person: p,
              total,
              maxEmoji,
              maxCount,
            };
          })
          .sort((a, b) => b.total - a.total)
          .map(({ person, total, maxEmoji, maxCount }) => (
            <span key={person.id}>
              {person.name}: <span className="font-semibold">{total}</span>{" "}
              emoji
              {total !== 1 ? "s" : ""}{" "}
              {maxEmoji ? (
                <>
                  | Top: <span className="text-lg">{maxEmoji}</span> ({maxCount}{" "}
                  uses)
                </>
              ) : (
                "| No emoji"
              )}
            </span>
          ))}
      </div>
      <div
        className="mx-auto w-full"
        style={{ minHeight: 600, maxHeight: 1200 }}
      >
        <Bar data={data} options={options} />
      </div>
    </>
  );
};
