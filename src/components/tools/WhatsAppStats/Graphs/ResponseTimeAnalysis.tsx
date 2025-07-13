import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";

export const ResponseTimeAnalysis = ({ messages, persons }: GraphProps) => {
  const responseTimeData = useMemo(() => {
    if (messages.length < 2) return null;

    // Sort messages by date and time
    const sortedMessages = [...messages].sort((a, b) => {
      const [aDay, aMonth, aYear] = a.date.split("/").map(Number);
      const [bDay, bMonth, bYear] = b.date.split("/").map(Number);
      const aDate = new Date(aYear, aMonth - 1, aDay);
      const bDate = new Date(bYear, bMonth - 1, bDay);

      if (aDate.getTime() !== bDate.getTime()) {
        return aDate.getTime() - bDate.getTime();
      }

      // If same date, sort by time
      const [aHour, aMin] = a.time.split(":").map(Number);
      const [bHour, bMin] = b.time.split(":").map(Number);
      return aHour * 60 + aMin - (bHour * 60 + bMin);
    });

    // Calculate response times
    const responseTimes: { responder: number; timeMinutes: number }[] = [];
    const responseTimeStats = new Map<number, number[]>();

    for (let i = 1; i < sortedMessages.length; i++) {
      const prevMsg = sortedMessages[i - 1];
      const currMsg = sortedMessages[i];

      // Skip if same person (not a response)
      if (prevMsg.personId === currMsg.personId) continue;

      // Calculate time difference
      const prevDate = new Date();
      const [prevDay, prevMonth, prevYear] = prevMsg.date
        .split("/")
        .map(Number);
      const [prevHour, prevMin] = prevMsg.time.split(":").map(Number);
      prevDate.setFullYear(prevYear, prevMonth - 1, prevDay);
      prevDate.setHours(prevHour, prevMin, 0, 0);

      const currDate = new Date();
      const [currDay, currMonth, currYear] = currMsg.date
        .split("/")
        .map(Number);
      const [currHour, currMin] = currMsg.time.split(":").map(Number);
      currDate.setFullYear(currYear, currMonth - 1, currDay);
      currDate.setHours(currHour, currMin, 0, 0);

      const diffMinutes =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60);

      // Only consider responses within 24 hours
      if (diffMinutes > 0 && diffMinutes <= 24 * 60) {
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
        <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
          Response Time Analysis
        </h3>
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
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Response Time Analysis
      </h3>
      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Analysis of how quickly people respond to each other (within 24 hours)
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
