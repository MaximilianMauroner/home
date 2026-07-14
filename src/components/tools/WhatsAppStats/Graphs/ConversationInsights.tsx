import { useMemo } from "react";
import type { GraphProps } from "./types";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";
import {
  calculateNormalizedShares,
  calculateReciprocity,
  calculateReviverStats,
  calculateStreaks,
  calculateWeekdayHourMatrix,
  formatHours,
  WEEKDAY_LABELS,
} from "../conversationMetrics";

const HOUR_LABELS = Array.from(
  { length: 24 },
  (_, hour) => `${hour.toString().padStart(2, "0")}:00`,
);

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const dateRange = (start: string, end: string) => {
  if (!start) return "n/a";
  return start === end ? start : `${start} to ${end}`;
};

const heatColor = (count: number, maxCount: number) => {
  if (count === 0 || maxCount === 0) return "rgba(148, 163, 184, 0.12)";
  const strength = count / maxCount;
  const opacity = 0.18 + strength * 0.72;
  return `rgba(37, 99, 235, ${opacity.toFixed(2)})`;
};

export const ConversationInsights = ({ messages, persons }: GraphProps) => {
  const insights = useMemo(
    () => ({
      reciprocity: calculateReciprocity(messages, persons),
      normalizedShares: calculateNormalizedShares(messages, persons),
      weekdayHour: calculateWeekdayHourMatrix(messages),
      streaks: calculateStreaks(messages),
      revivers: calculateReviverStats(messages, persons),
    }),
    [messages, persons],
  );

  const topShares = [...insights.normalizedShares].sort(
    (a, b) => b.messages - a.messages,
  );
  const topPair = insights.reciprocity.pairStats[0];
  const busiest = insights.weekdayHour.busiest;

  return (
    <>
      <ChartHeader
        title="Conversation Insights"
        assumption={CHART_ASSUMPTIONS.conversationInsights}
      />

      <div className="mb-6 grid gap-4 text-sm md:grid-cols-3">
        <div className="border-y py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reciprocity
          </div>
          <div className="mt-1 text-lg font-semibold">
            {topPair ? percent(topPair.balance) : "n/a"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {topPair
              ? `${topPair.firstName} / ${topPair.secondName}, ${topPair.total} replies`
              : "No adjacent cross-participant replies found"}
          </div>
        </div>

        <div className="border-y py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Busiest slot
          </div>
          <div className="mt-1 text-lg font-semibold">
            {busiest
              ? `${busiest.weekday} ${HOUR_LABELS[busiest.hour]}`
              : "n/a"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {busiest
              ? `${busiest.count} message${busiest.count !== 1 ? "s" : ""}`
              : "No timestamped messages found"}
          </div>
        </div>

        <div className="border-y py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Longest silent gap
          </div>
          <div className="mt-1 text-lg font-semibold">
            {insights.streaks
              ? formatHours(insights.streaks.longestGap.hours)
              : "n/a"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {insights.streaks
              ? `Revived by ${
                  persons.find(
                    (person) =>
                      person.id === insights.streaks?.longestGap.to.personId,
                  )?.name || "Unknown"
                }`
              : "No gap data found"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div>
          <div className="mb-2 flex items-end justify-between gap-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Weekday / Hour Heatmap
            </h4>
            <span className="text-xs text-muted-foreground">
              Max: {insights.weekdayHour.maxCount}
            </span>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Darker blue means more messages in that weekday/hour slot.</span>
            <div className="flex items-center gap-1" aria-label="Heatmap color scale">
              <span className="mr-1 text-xs">Less</span>
              {[0, 0.25, 0.5, 0.75, 1].map((strength) => (
                <span
                  key={strength}
                  className="h-4 w-4 rounded-sm border border-border/60"
                  style={{
                    backgroundColor:
                      strength === 0
                        ? heatColor(0, 1)
                        : heatColor(strength, 1),
                  }}
                />
              ))}
              <span className="ml-1 text-xs">More</span>
            </div>
          </div>
          <div className="tool-scroll-area overflow-x-auto pb-2">
            <div className="grid w-max grid-cols-[3rem_repeat(24,1.4rem)] gap-1">
              <div />
              {HOUR_LABELS.map((label, index) => (
                <div
                  key={label}
                  className="text-center text-[10px] text-muted-foreground"
                >
                  {index % 3 === 0 ? index : ""}
                </div>
              ))}
              {WEEKDAY_LABELS.map((weekday, weekdayIndex) => (
                <div key={weekday} className="contents">
                  <div className="pr-2 text-right text-xs text-muted-foreground">
                    {weekday}
                  </div>
                  {insights.weekdayHour.matrix[weekdayIndex].map(
                    (count, hour) => (
                      <div
                        key={`${weekday}-${hour}`}
                        className="h-5 w-5 rounded-sm border border-border/60"
                        style={{
                          backgroundColor: heatColor(
                            count,
                            insights.weekdayHour.maxCount,
                          ),
                        }}
                        title={`${weekday} ${HOUR_LABELS[hour]}: ${count} message${
                          count !== 1 ? "s" : ""
                        }`}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <section>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Longest streaks
            </h4>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Active days</dt>
              <dd>
                {insights.streaks
                  ? `${insights.streaks.activeDayStreak.length} (${dateRange(
                      insights.streaks.activeDayStreak.start,
                      insights.streaks.activeDayStreak.end,
                    )})`
                  : "n/a"}
              </dd>
              <dt className="text-muted-foreground">Silent days</dt>
              <dd>
                {insights.streaks
                  ? `${insights.streaks.silentDayStreak.length} (${dateRange(
                      insights.streaks.silentDayStreak.start,
                      insights.streaks.silentDayStreak.end,
                    )})`
                  : "n/a"}
              </dd>
            </dl>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conversation revivers
            </h4>
            {insights.revivers.revivers.length > 0 ? (
              <div className="space-y-2">
                {insights.revivers.revivers.slice(0, 5).map((reviver) => (
                  <div key={reviver.personId}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span>{reviver.name}</span>
                      <span className="text-muted-foreground">
                        {reviver.revivals} ({percent(reviver.share)})
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: percent(reviver.share) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No conversation restarts found.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="tool-scroll-area mt-6 overflow-x-auto border-y">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Participant</th>
              <th className="px-3 py-2 font-medium">Messages</th>
              <th className="px-3 py-2 font-medium">Message share</th>
              <th className="px-3 py-2 font-medium">Words</th>
              <th className="px-3 py-2 font-medium">Word share</th>
              <th className="px-3 py-2 font-medium">Active days</th>
              <th className="px-3 py-2 font-medium">Msgs / active day</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {topShares.map((share) => (
              <tr key={share.personId}>
                <td className="px-3 py-2 font-medium">{share.name}</td>
                <td className="px-3 py-2">{share.messages}</td>
                <td className="px-3 py-2">{percent(share.messageShare)}</td>
                <td className="px-3 py-2">{share.words}</td>
                <td className="px-3 py-2">{percent(share.wordShare)}</td>
                <td className="px-3 py-2">{share.activeDays}</td>
                <td className="px-3 py-2">
                  {share.messagesPerActiveDay.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {insights.reciprocity.pairStats.length > 0 && (
        <div className="tool-scroll-area mt-6 overflow-x-auto border-y">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Pair</th>
                <th className="px-3 py-2 font-medium">First replies</th>
                <th className="px-3 py-2 font-medium">Second replies</th>
                <th className="px-3 py-2 font-medium">Reply balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {insights.reciprocity.pairStats.slice(0, 6).map((pair) => (
                <tr key={`${pair.firstPersonId}-${pair.secondPersonId}`}>
                  <td className="px-3 py-2 font-medium">
                    {pair.firstName} / {pair.secondName}
                  </td>
                  <td className="px-3 py-2">
                    {pair.firstName}: {pair.firstAfterSecond}
                  </td>
                  <td className="px-3 py-2">
                    {pair.secondName}: {pair.secondAfterFirst}
                  </td>
                  <td className="px-3 py-2">{percent(pair.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
