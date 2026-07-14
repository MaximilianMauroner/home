import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";
import {
  getConversationRestarts,
  sortMessagesByTimestamp,
} from "../conversationMetrics";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";

export const ConversationStarters = ({ messages, persons }: GraphProps) => {
  const conversationData = useMemo(() => {
    if (messages.length < 2) return null;

    const sortedMessages = sortMessagesByTimestamp(messages);

    // Find conversation starts
    const conversationStarts = new Map<number, number>();
    const conversationDetails: { starter: number; gapHours: number }[] = [];

    // First message is always a conversation starter
    conversationStarts.set(sortedMessages[0].personId, 1);

    for (const restart of getConversationRestarts(sortedMessages)) {
      const count = conversationStarts.get(restart.current.personId) || 0;
      conversationStarts.set(restart.current.personId, count + 1);
      conversationDetails.push({
        starter: restart.current.personId,
        gapHours: restart.gapHours,
      });
    }

    // Calculate statistics
    const stats = persons.map((person) => {
      const starts = conversationStarts.get(person.id) || 0;
      const details = conversationDetails.filter(
        (d) => d.starter === person.id,
      );
      const avgGap =
        details.length > 0
          ? details.reduce((sum, d) => sum + d.gapHours, 0) / details.length
          : 0;

      return {
        person: person.name,
        starts,
        avgGapHours: avgGap,
        restartCount: details.length,
        percentage: 0, // Will be calculated after
      };
    });

    const totalStarts = stats.reduce((sum, stat) => sum + stat.starts, 0);
    stats.forEach((stat) => {
      stat.percentage = totalStarts > 0 ? (stat.starts / totalStarts) * 100 : 0;
    });

    return { stats, totalStarts, conversationDetails };
  }, [messages, persons]);

  if (!conversationData || conversationData.totalStarts === 0) {
    return (
      <div>
        <ChartHeader
          title="Conversation Starters"
          assumption={CHART_ASSUMPTIONS.conversationStarters}
        />
        <p className="text-sm text-muted-foreground">
          Not enough data to analyze conversation patterns.
        </p>
      </div>
    );
  }

  const colorMap = getParticipantColors(persons.map((p) => p.name));

  const barData = {
    labels: conversationData.stats.map((stat) => stat.person),
    datasets: [
      {
        label: "Conversations Started",
        data: conversationData.stats.map((stat) => stat.starts),
        backgroundColor: conversationData.stats.map(
          (stat) => colorMap[stat.person]?.bg || "#36A2EB",
        ),
        borderColor: conversationData.stats.map(
          (stat) => colorMap[stat.person]?.border || "#36A2EB",
        ),
        borderWidth: 2,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const stat = conversationData.stats[context.dataIndex];
            return [
              `${stat.starts} conversations started`,
              `${stat.percentage.toFixed(1)}% of total`,
              stat.restartCount > 0
                ? `Avg restart gap: ${stat.avgGapHours.toFixed(1)} hours`
                : "Avg restart gap: n/a",
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Conversations Started",
        },
      },
    },
  };

  return (
    <>
      <ChartHeader
        title="Conversation Starters"
        assumption={CHART_ASSUMPTIONS.conversationStarters}
      />
      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Who initiates conversations most often (after 4+ hour gaps or 1+ hour
          on different days)
        </p>
        <p className="mt-1">
          Total conversations identified: {conversationData.totalStarts}
        </p>
        <div className="mt-2 space-y-1">
          {[...conversationData.stats]
            .sort((a, b) => b.starts - a.starts)
            .map((stat) => (
              <div key={stat.person} className="text-xs">
                <strong>{stat.person}</strong>: {stat.starts} conversations (
                {stat.percentage.toFixed(1)}%), avg restart gap{" "}
                {stat.restartCount > 0
                  ? `${stat.avgGapHours.toFixed(1)} hours`
                  : "n/a"}
              </div>
            ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium">Count Comparison</h4>
        <Bar data={barData} options={barOptions} />
      </div>
    </>
  );
};
