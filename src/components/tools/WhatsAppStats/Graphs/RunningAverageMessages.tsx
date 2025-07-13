import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";

interface DayOption {
  value: number;
  label: string;
}

type MetricType = "messages" | "words";

const DAY_OPTIONS: DayOption[] = [
  { value: 3, label: "3 Days" },
  { value: 7, label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 30, label: "30 Days" },
];

export const RunningAverageMessages = ({ messages, persons }: GraphProps) => {
  const [selectedDays, setSelectedDays] = useState(7);
  const [metricType, setMetricType] = useState<MetricType>("messages");

  const chartData = useMemo(() => {
    if (!messages.length) return null;

    // Group messages by date and person
    const messagesPerDatePerPerson = new Map<string, Map<number, number>>();
    const wordsPerDatePerPerson = new Map<string, Map<number, number>>();

    // Parse all dates and sort them
    const allDates = new Set<string>();

    for (const message of messages) {
      allDates.add(message.date);

      if (!messagesPerDatePerPerson.has(message.date)) {
        messagesPerDatePerPerson.set(message.date, new Map());
        wordsPerDatePerPerson.set(message.date, new Map());
      }

      const messageMap = messagesPerDatePerPerson.get(message.date)!;
      const wordMap = wordsPerDatePerPerson.get(message.date)!;

      // Count messages
      messageMap.set(
        message.personId,
        (messageMap.get(message.personId) || 0) + 1,
      );

      // Count words
      const wordCount = message.text
        ? message.text.trim().split(/\s+/).length
        : 0;
      wordMap.set(
        message.personId,
        (wordMap.get(message.personId) || 0) + wordCount,
      );
    }

    // Convert dates to sorted array
    const sortedDates = Array.from(allDates).sort((a, b) => {
      const [dayA, monthA, yearA] = a.split("/").map(Number);
      const [dayB, monthB, yearB] = b.split("/").map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate running averages for each person
    const runningAverages = new Map<number, number[]>();
    const labels: string[] = [];

    // Initialize running averages for each person
    for (const person of persons) {
      runningAverages.set(person.id, []);
    }

    const dataSource =
      metricType === "messages"
        ? messagesPerDatePerPerson
        : wordsPerDatePerPerson;

    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];
      labels.push(currentDate);

      // For each person, calculate the running average
      for (const person of persons) {
        const personAverages = runningAverages.get(person.id)!;

        // Get the last 'selectedDays' worth of data
        const startIndex = Math.max(0, i - selectedDays + 1);
        const relevantDates = sortedDates.slice(startIndex, i + 1);

        let totalCount = 0;
        for (const date of relevantDates) {
          const dayData = dataSource.get(date);
          if (dayData) {
            totalCount += dayData.get(person.id) || 0;
          }
        }

        const average = totalCount / relevantDates.length;
        personAverages.push(average);
      }
    }

    // Calculate statistics for each person
    const stats = persons.map((person) => {
      const personData = runningAverages.get(person.id) || [];
      const validData = personData.filter((value) => value > 0);

      return {
        personId: person.id,
        name: person.name,
        min: validData.length > 0 ? Math.min(...validData) : 0,
        max: validData.length > 0 ? Math.max(...validData) : 0,
      };
    });

    // Create chart data
    const colorMap = getParticipantColors(persons.map((p) => p.name));

    const datasets = persons.map((person) => ({
      label: person.name,
      data: runningAverages.get(person.id) || [],
      borderColor: colorMap[person.name].border,
      backgroundColor: colorMap[person.name].bg,
      borderWidth: 2,
      fill: false,
      tension: 0.1,
    }));

    return {
      labels,
      datasets,
      stats,
    };
  }, [messages, persons, selectedDays, metricType]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const value = context.parsed.y;
              const unit =
                metricType === "messages" ? "messages/day" : "words/day";
              return `${context.dataset.label}: ${value.toFixed(2)} ${unit}`;
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Date",
          },
          ticks: {
            maxTicksLimit: 10,
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text:
              metricType === "messages"
                ? "Average Messages per Day"
                : "Average Words per Day",
          },
          beginAtZero: true,
        },
      },
    }),
    [metricType],
  );

  if (!chartData) {
    return (
      <div className="text-center text-muted-foreground">No data available</div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold sm:text-base">
          Running Average {metricType === "messages" ? "Messages" : "Words"} per
          Participant
        </h3>
        <div className="flex gap-2">
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as MetricType)}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="messages">Messages</option>
            <option value="words">Words</option>
          </select>
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Running average {metricType} over {selectedDays} days
      </p>

      {/* Statistics Table */}
      {chartData?.stats && (
        <div className="mb-4 overflow-hidden rounded-lg border bg-card">
          <div className="border-b bg-muted/50 px-4 py-3">
            <h4 className="text-sm font-semibold text-card-foreground">
              {metricType === "messages" ? "Messages" : "Words"} per Day
              Statistics
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Participant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Lowest Avg
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Highest Avg
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {chartData.stats.map((stat) => (
                  <tr
                    key={stat.personId}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-card-foreground">
                      {stat.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {stat.min.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {stat.max.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="h-64 w-full sm:h-80">
        <Line data={chartData} options={chartOptions} />
      </div>
    </>
  );
};
