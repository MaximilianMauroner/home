import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { hourFromTime } from "../datetime";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";
import { LINE_CHART_INTERACTION } from "./chartOptions";

export const ActivityByTime = ({ messages, persons }: GraphProps) => {
  // Prepare data
  const { data, options } = useMemo(() => {
    const intervals = Array.from({ length: 24 }, (_, i) => i);

    // Total counts per interval (not per person)
    const counts = Array(24).fill(0);

    // Per participant per interval
    const participantCounts: Record<number, number[]> = {};
    persons.forEach((p) => {
      participantCounts[p.id] = Array(24).fill(0);
    });

    messages.forEach((msg) => {
      const interval = hourFromTime(msg.time);
      if (interval === null) return;
      counts[interval]++;
      if (participantCounts[msg.personId]) {
        participantCounts[msg.personId][interval]++;
      }
    });

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
      maintainAspectRatio: false,
      interaction: LINE_CHART_INTERACTION,
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
    };
  }, [messages, persons]);

  return (
    <>
      <ChartHeader
        title="Activity by Hour"
        assumption={CHART_ASSUMPTIONS.activityByHour}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Most Active Hour:{" "}
        {(() => {
          // Find the interval with the highest total messages
          const hourTotals = data.datasets[0].data;
          const maxCount = Math.max(...hourTotals);
          const maxIdx = hourTotals.findIndex((v: number) => v === maxCount);
          return `${data.labels[maxIdx]} (${maxCount} messages)`;
        })()}
      </p>
      <div className="mx-auto h-64 w-full sm:h-96">
        <Line data={data} options={options} />
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
          View hourly data table
        </summary>
        <div className="tool-scroll-area mt-2 max-h-72 overflow-auto rounded-lg border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="px-3 py-2">Hour</th>
                <th className="px-3 py-2">Messages</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.labels.map((label, index) => (
                <tr key={label}>
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2">{data.datasets[0].data[index]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
};
