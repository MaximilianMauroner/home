import { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors, EMOJI_PATTERN } from "./utils";

export const WordsPerPerson = ({ messages, persons }: GraphProps) => {
  let totalMessages = 0;

  const { messagesPerPerson, wordCountsPerPerson, pieData } = useMemo(() => {
    const messagesPerPerson = new Map<number, number>();
    const wordCountsPerPerson = new Map<number, number[]>();
    for (const message of messages) {
      const personId = message.personId;
      const count = messagesPerPerson.get(personId) || 0;
      const wordCount = message.text
        .replace(EMOJI_PATTERN, "")
        .trim()
        .split(/\s+/).length;
      totalMessages += wordCount;
      messagesPerPerson.set(personId, count + wordCount);

      if (!wordCountsPerPerson.has(personId)) {
        wordCountsPerPerson.set(personId, []);
      }
      wordCountsPerPerson.get(personId)!.push(wordCount);

      // Track messages per day per person
    }

    const colorMap = getParticipantColors(persons.map((p) => p.name));
    const labels = persons.map((p) => p.name);
    const backgroundColor = persons.map((p) => colorMap[p.name].bg);
    const borderColor = persons.map((p) => colorMap[p.name].border);
    const pieData = {
      labels,
      datasets: [
        {
          label: "Words per user",
          data: persons.map((p) => messagesPerPerson.get(p.id) || 0),
          backgroundColor,
          borderColor,
          borderWidth: 2,
        },
      ],
    };

    return {
      messagesPerPerson,
      wordCountsPerPerson,
      colorMap,
      labels,
      backgroundColor,
      borderColor,
      pieData,
    };
  }, [messages, persons]);

  // Pie chart options with custom tooltip
  const pieOptions = useMemo(
    () => ({
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const personIdx = context.dataIndex;
              const person = persons[personIdx];
              const personId = person.id;
              const totalWords = messagesPerPerson.get(personId) || 0;
              const wordCounts = wordCountsPerPerson.get(personId) || [];
              const numMessages = wordCounts.length;
              const avg =
                numMessages > 0 ? (totalWords / numMessages).toFixed(2) : "0";
              // Median calculation
              let median = "0";
              if (numMessages > 0) {
                const sorted = [...wordCounts].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                median =
                  sorted.length % 2 === 0
                    ? ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
                    : sorted[mid].toFixed(2);
              }
              // Messages per day
              return [
                `${totalWords} words`,
                `${avg} words/msg (average)`,
                `${median} words/msg (median)`,
              ];
            },
          },
        },
      },
    }),
    [messagesPerPerson, wordCountsPerPerson, persons],
  );

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Words per Participant
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Total Words: {totalMessages}
      </p>
      <div className="mx-auto aspect-square w-full">
        <Pie data={pieData} options={pieOptions} />
      </div>
    </>
  );
};
