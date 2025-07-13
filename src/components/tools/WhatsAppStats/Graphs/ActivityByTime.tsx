import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { GraphProps } from "./types";

export const ActivityByTime = ({ messages, persons }: GraphProps) => {
  // Prepare data
  const { data, options, totalMessages, participantCounts } = useMemo(() => {
    // 24 intervals
    const intervals = Array.from({ length: 24 }, (_, i) => i);

    // Total counts per interval (not per person)
    const counts = Array(24).fill(0);

    // Per participant per interval
    const participantCounts: Record<number, number[]> = {};
    persons.forEach((p) => {
      participantCounts[p.id] = Array(24).fill(0);
    });

    let totalMessages = 0;

    messages.forEach((msg) => {
      if (!msg.time) return;
      const [h] = msg.time.split(":").map(Number);
      if (typeof h !== "number") return;
      // Round up to next highest 15 min interval
      let interval = h;
      if (interval > 24) interval = 24; // Clamp to last interval
      counts[interval]++;
      if (participantCounts[msg.personId]) {
        participantCounts[msg.personId][interval]++;
      }
      totalMessages++;
    });

    // Labels for each 15-min interval
    const labels = intervals.map((i) => {
      return `${i.toString().padStart(2, "0")}:00`;
    });

    const dataset = {
      label: "Total Messages",
      data: counts,
      fill: false,
      borderColor: "#36A2EB",
      backgroundColor: "#36A2EB",
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 4,
    };

    const data = {
      labels,
      datasets: [dataset],
    };

    const sharedLineChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const idx = context.dataIndex;
              const total = counts[idx];
              if (total === 0) return "0 messages";
              // Breakdown per participant
              const sortedPersons = persons
                .map((p) => ({
                  ...p,
                  count: participantCounts[p.id][idx],
                  share: ((participantCounts[p.id][idx] / total) * 100).toFixed(
                    1,
                  ),
                }))
                .filter((p) => p.count > 0)
                .sort((a, b) => b.count - a.count);
              const breakdown = sortedPersons.map(
                (p) => `${p.name}: ${p.count} (${p.share}%)`,
              );
              return [`${total} messages`, `Breakdown: `, ...breakdown];
            },
          },
        },
      },
    };

    return {
      data,
      options: sharedLineChartOptions,
      totalMessages,
      participantCounts,
    };
  }, [messages, persons]);

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Activity by 15-Minute Interval
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Most Active Interval:{" "}
        {(() => {
          // Find the interval with the highest total messages
          const hourTotals = data.datasets[0].data;
          const maxCount = Math.max(...hourTotals);
          const maxIdx = hourTotals.findIndex((v: number) => v === maxCount);
          return `${data.labels[maxIdx]} (${maxCount} messages)`;
        })()}
      </p>
      <div className="mx-auto w-full">
        <Line data={data} options={options} />
      </div>
    </>
  );
};
