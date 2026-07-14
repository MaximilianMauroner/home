import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";
import { gapHoursBetweenMessages } from "../datetime";
import {
  getConversationRestartGap,
  sortMessagesByTimestamp,
} from "../conversationMetrics";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";

export const ResponseTimeAnalysis = ({ messages, persons }: GraphProps) => {
  const responseTimeData = useMemo(() => {
    if (messages.length < 2) return null;

    const sortedMessages = sortMessagesByTimestamp(messages);

    // Calculate response times
    const responseTimes: { responder: number; timeMinutes: number }[] = [];
    const responseTimeStats = new Map<number, number[]>();

    for (let i = 1; i < sortedMessages.length; i++) {
      const prevMsg = sortedMessages[i - 1];
      const currMsg = sortedMessages[i];

      // Skip if same person (not a response)
      if (prevMsg.personId === currMsg.personId) continue;

      const gapHours = gapHoursBetweenMessages(prevMsg, currMsg);
      if (gapHours === null) continue;

      const startsNewConversation =
        getConversationRestartGap(prevMsg, currMsg) !== null;
      const diffMinutes = gapHours * 60;

      // Only consider replies inside the same conversation.
      if (diffMinutes > 0 && diffMinutes <= 24 * 60 && !startsNewConversation) {
        responseTimes.push({
          responder: currMsg.personId,
          timeMinutes: diffMinutes,
        });

        if (!responseTimeStats.has(currMsg.personId)) {
          responseTimeStats.set(currMsg.personId, []);
        }
        responseTimeStats.get(currMsg.personId)!.push(diffMinutes);
      }
    }

    // Calculate statistics for each person
    const stats = persons
      .map((person) => {
        const times = responseTimeStats.get(person.id) || [];
        if (times.length === 0) {
          return {
            person: person.name,
            avgMinutes: 0,
            medianMinutes: 0,
            count: 0,
          };
        }

        const sorted = [...times].sort((a, b) => a - b);
        const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
        const median =
          sorted.length % 2 === 0
            ? (sorted[Math.floor(sorted.length / 2) - 1] +
                sorted[Math.floor(sorted.length / 2)]) /
              2
            : sorted[Math.floor(sorted.length / 2)];

        return {
          person: person.name,
          avgMinutes: avg,
          medianMinutes: median,
          count: times.length,
        };
      })
      .filter((stat) => stat.count > 0);

    return { stats, responseTimes };
  }, [messages, persons]);

  if (!responseTimeData || responseTimeData.stats.length === 0) {
    return (
      <div>
        <ChartHeader
          title="Response Time Analysis"
          assumption={CHART_ASSUMPTIONS.responseTime}
        />
        <p className="text-sm text-muted-foreground">
          Not enough conversation data to analyze response times.
        </p>
      </div>
    );
  }

  const colorMap = getParticipantColors(persons.map((p) => p.name));

  const avgData = {
    labels: responseTimeData.stats.map((stat) => stat.person),
    datasets: [
      {
        label: "Average Response Time (minutes)",
        data: responseTimeData.stats.map((stat) => stat.avgMinutes),
        backgroundColor: responseTimeData.stats.map(
          (stat) => colorMap[stat.person]?.bg || "#36A2EB",
        ),
        borderColor: responseTimeData.stats.map(
          (stat) => colorMap[stat.person]?.border || "#36A2EB",
        ),
        borderWidth: 2,
      },
    ],
  };

  const medianData = {
    labels: responseTimeData.stats.map((stat) => stat.person),
    datasets: [
      {
        label: "Median Response Time (minutes)",
        data: responseTimeData.stats.map((stat) => stat.medianMinutes),
        backgroundColor: responseTimeData.stats.map(
          (stat) => colorMap[stat.person]?.bg || "#FF6384",
        ),
        borderColor: responseTimeData.stats.map(
          (stat) => colorMap[stat.person]?.border || "#FF6384",
        ),
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const stat = responseTimeData.stats[context.dataIndex];
            const minutes = context.parsed.y;
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            return [
              `${context.dataset.label}: ${timeStr}`,
              `Responses analyzed: ${stat.count}`,
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
          text: "Time (minutes)",
        },
        ticks: {
          callback: function (value: any) {
            const minutes = Number(value);
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          },
        },
      },
    },
  };

  return (
    <>
      <ChartHeader
        title="Response Time Analysis"
        assumption={CHART_ASSUMPTIONS.responseTime}
      />
      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Analysis of how quickly people respond before a conversation restart
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {responseTimeData.stats.map((stat) => {
            const avgHours = Math.floor(stat.avgMinutes / 60);
            const avgMins = Math.round(stat.avgMinutes % 60);
            const medianHours = Math.floor(stat.medianMinutes / 60);
            const medianMins = Math.round(stat.medianMinutes % 60);

            return (
              <div key={stat.person} className="text-xs">
                <strong>{stat.person}</strong>: Avg{" "}
                {avgHours > 0 ? `${avgHours}h ${avgMins}m` : `${avgMins}m`},
                Median{" "}
                {medianHours > 0
                  ? `${medianHours}h ${medianMins}m`
                  : `${medianMins}m`}{" "}
                ({stat.count} responses)
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-medium">Average Response Time</h4>
          <Bar data={avgData} options={options} />
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium">Median Response Time</h4>
          <Bar data={medianData} options={options} />
        </div>
      </div>
    </>
  );
};
