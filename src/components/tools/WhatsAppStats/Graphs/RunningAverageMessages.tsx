import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";

interface DayOption {
  value: number;
  label: string;
}

const DAY_OPTIONS: DayOption[] = [
  { value: 3, label: "3 Days" },
  { value: 7, label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 30, label: "30 Days" },
];

export const RunningAverageMessages = ({ messages, persons }: GraphProps) => {
  const [selectedDays, setSelectedDays] = useState(7);

  const chartData = useMemo(() => {
    if (!messages.length) return null;

    // Group messages by date and person
    const messagesPerDatePerPerson = new Map<string, Map<number, number>>();

    // Parse all dates and sort them
    const allDates = new Set<string>();

    for (const message of messages) {
      allDates.add(message.date);

      if (!messagesPerDatePerPerson.has(message.date)) {
        messagesPerDatePerPerson.set(message.date, new Map());
      }

      const personMap = messagesPerDatePerPerson.get(message.date)!;
      personMap.set(
        message.personId,
        (personMap.get(message.personId) || 0) + 1,
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

    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];
      labels.push(currentDate);

      // For each person, calculate the running average
      for (const person of persons) {
        const personAverages = runningAverages.get(person.id)!;

        // Get the last 'selectedDays' worth of data
        const startIndex = Math.max(0, i - selectedDays + 1);
        const relevantDates = sortedDates.slice(startIndex, i + 1);

        let totalMessages = 0;
        for (const date of relevantDates) {
          const dayData = messagesPerDatePerPerson.get(date);
          if (dayData) {
            totalMessages += dayData.get(person.id) || 0;
          }
        }

        const average = totalMessages / relevantDates.length;
        personAverages.push(average);
      }
    }

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
    };
  }, [messages, persons, selectedDays]);

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
              return `${context.dataset.label}: ${value.toFixed(2)} messages/day`;
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
            text: "Average Messages per Day",
          },
          beginAtZero: true,
        },
      },
    }),
    [],
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
          Running Average Messages per Participant
        </h3>
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
      <p className="mb-4 text-sm text-muted-foreground">
        Running average over {selectedDays} days
      </p>
      <div className="h-64 w-full sm:h-80">
        <Line data={chartData} options={chartOptions} />
      </div>
    </>
  );
};
