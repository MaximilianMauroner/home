import { useMemo } from "react";
import type { GraphProps } from "./types";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";
import { getParticipantColors } from "./utils";
import { countWords } from "../conversationMetrics";
import { isMediaPlaceholder, isTextualMessage } from "../messageClassification";

interface ParticipantMetric {
  personId: number;
  name: string;
  messages: number;
  words: number;
  media: number;
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export const ParticipantDistribution = ({ messages, persons }: GraphProps) => {
  const { rows, totals, colorMap } = useMemo(() => {
    const metrics = new Map<number, ParticipantMetric>();

    for (const person of persons) {
      metrics.set(person.id, {
        personId: person.id,
        name: person.name,
        messages: 0,
        words: 0,
        media: 0,
      });
    }

    for (const message of messages) {
      const metric = metrics.get(message.personId);
      if (!metric) continue;

      metric.messages += 1;
      if (isTextualMessage(message.text)) {
        metric.words += countWords(message.text);
      }
      if (isMediaPlaceholder(message.text)) {
        metric.media += 1;
      }
    }

    const rows = [...metrics.values()].sort((a, b) => b.messages - a.messages);
    const totals = rows.reduce(
      (acc, row) => ({
        messages: acc.messages + row.messages,
        words: acc.words + row.words,
        media: acc.media + row.media,
      }),
      { messages: 0, words: 0, media: 0 },
    );

    return {
      rows,
      totals,
      colorMap: getParticipantColors(persons.map((person) => person.name)),
    };
  }, [messages, persons]);

  const metrics = [
    {
      key: "messages" as const,
      label: "Messages",
      total: totals.messages,
      assumption: CHART_ASSUMPTIONS.messagesPerPerson,
    },
    {
      key: "words" as const,
      label: "Words",
      total: totals.words,
      assumption: CHART_ASSUMPTIONS.wordsPerPerson,
    },
    {
      key: "media" as const,
      label: "Media placeholders",
      total: totals.media,
      assumption: CHART_ASSUMPTIONS.mediaMessages,
    },
  ];

  return (
    <>
      <ChartHeader
        title="Participant Distribution"
        assumption="Compares participant message, word, and media-placeholder totals using the same loaded chat/year. Bars are sorted by message count."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {metrics.map((metric) => (
          <section key={metric.key} className="border-y py-3">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">{metric.label}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total: {metric.total.toLocaleString()}
                </p>
              </div>
            </div>
            {metric.total > 0 ? (
              <div className="space-y-3">
                {rows.map((row) => {
                  const value = row[metric.key];
                  const share = metric.total > 0 ? (value / metric.total) * 100 : 0;
                  const color =
                    colorMap[row.name]?.border ?? "rgba(59, 130, 246, 1)";

                  return (
                    <div key={`${metric.key}-${row.personId}`}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{row.name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {value.toLocaleString()} ({formatPercent(share)})
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${share}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No {metric.label.toLowerCase()} found for this selection.
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
};
