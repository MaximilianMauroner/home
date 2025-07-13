import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors, EMOJI_PATTERN } from "./utils";
import { COMMON_WORDS } from "@/lib/words";

export const WordActivity = ({ messages, persons }: GraphProps) => {
  // Build word counts per person and total
  const { sortedWords, wordPerPerson } = useMemo(() => {
    const wordCounts = new Map<string, number>();
    const wordPerPerson: Record<string, Record<number, number>> = {};

    messages.forEach((msg) => {
      // Remove emojis and punctuation, split by whitespace
      const words = msg.text
        .replace(EMOJI_PATTERN, "")
        .replace(/[.,!?;:"'`´()\[\]{}<>\/\\|@#$%^&*_+=~0-9]/g, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      words.forEach((word) => {
        if (word.length < 4) return;
        if (COMMON_WORDS.has(word)) return;
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        if (!wordPerPerson[word]) wordPerPerson[word] = {};
        wordPerPerson[word][msg.personId] =
          (wordPerPerson[word][msg.personId] || 0) + 1;
      });
    });

    // Sort by total count, descending
    const sortedWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    return { sortedWords, wordPerPerson };
  }, [messages]);

  if (sortedWords.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
          Word Usage
        </h3>
        <p className="text-sm text-muted-foreground">No words found.</p>
      </div>
    );
  }

  // Prepare stacked datasets: one for each person
  const colorMap = getParticipantColors(persons.map((p) => p.name));
  const personColors = persons.map((p) => colorMap[p.name]);
  const data = {
    labels: sortedWords.map(([word]) => word),
    datasets: persons.map((p, idx) => ({
      label: p.name,
      data: sortedWords.map(([word]) => wordPerPerson[word]?.[p.id] || 0),
      backgroundColor: personColors[idx % personColors.length].bg,
      borderColor: personColors[idx % personColors.length].border,
      borderWidth: 1,
      stack: "words",
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
        beginAtZero: true,
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
      <h3 className="mb-2 mt-8 text-sm font-semibold sm:mb-4 sm:text-base">
        Word Usage (Top 30, excluding common words)
      </h3>
      <div className="mb-4 flex flex-col flex-wrap text-sm text-muted-foreground">
        {persons.map((p) => {
          let maxWord = null;
          let maxCount = 0;
          Object.entries(wordPerPerson).forEach(([word, perPerson]) => {
            const count = perPerson[p.id] || 0;
            if (count > maxCount) {
              maxCount = count;
              maxWord = word;
            }
          });
          return (
            <span key={p.id}>
              Top {p.name}: &nbsp;
              {maxWord ? (
                <>
                  <span className="font-mono">{maxWord}</span> ({maxCount} uses)
                </>
              ) : (
                "| No word"
              )}
            </span>
          );
        })}
      </div>
      <div
        className="mx-auto w-full"
        style={{ minHeight: 600, maxHeight: 1800 }}
      >
        <Bar data={data} options={options} />
      </div>
    </>
  );
};
