import { useMemo } from "react";
import { Line, Bar } from "react-chartjs-2";
import type { GraphProps } from "./types";

export const SilentPeriods = ({ messages, persons }: GraphProps) => {
  const silentData = useMemo(() => {
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

    // Find silent periods and revival patterns
    const silentPeriods: {
      gapHours: number;
      reviver: number;
      reviverName: string;
      startDate: string;
      endDate: string;
    }[] = [];

    const gapDistribution = new Map<string, number>();
    const reviverStats = new Map<number, number>();

    for (let i = 1; i < sortedMessages.length; i++) {
      const prevMsg = sortedMessages[i - 1];
      const currMsg = sortedMessages[i];

      // Calculate time gap
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

      const gapHours =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60);

      // Consider silent periods of 4+ hours
      if (gapHours >= 4) {
        const reviverPerson = persons.find((p) => p.id === currMsg.personId);
        silentPeriods.push({
          gapHours,
          reviver: currMsg.personId,
          reviverName: reviverPerson?.name || "Unknown",
          startDate: prevMsg.date + " " + prevMsg.time,
          endDate: currMsg.date + " " + currMsg.time,
        });

        // Update reviver stats
        reviverStats.set(
          currMsg.personId,
          (reviverStats.get(currMsg.personId) || 0) + 1,
        );

        // Gap distribution buckets
        let gapBucket: string;
        if (gapHours < 8) gapBucket = "4-8 hours";
        else if (gapHours < 24) gapBucket = "8-24 hours";
        else if (gapHours < 48) gapBucket = "1-2 days";
        else if (gapHours < 168) gapBucket = "2-7 days";
        else gapBucket = "1+ weeks";

        gapDistribution.set(
          gapBucket,
          (gapDistribution.get(gapBucket) || 0) + 1,
        );
      }
    }

    // Calculate revival statistics
    const reviverStatsArray = persons
      .map((person) => ({
        person: person.name,
        revivals: reviverStats.get(person.id) || 0,
        percentage: 0, // Will be calculated after
      }))
      .filter((stat) => stat.revivals > 0);

    const totalRevivals = reviverStatsArray.reduce(
      (sum, stat) => sum + stat.revivals,
      0,
    );
    reviverStatsArray.forEach((stat) => {
      stat.percentage =
        totalRevivals > 0 ? (stat.revivals / totalRevivals) * 100 : 0;
    });

    // Calculate overall statistics
    const avgGap =
      silentPeriods.length > 0
        ? silentPeriods.reduce((sum, period) => sum + period.gapHours, 0) /
          silentPeriods.length
        : 0;

    const longestGap =
      silentPeriods.length > 0
        ? Math.max(...silentPeriods.map((p) => p.gapHours))
        : 0;

    // Prepare timeline data (showing gaps over time)
    const timelineData: { date: string; gapHours: number }[] = [];
    silentPeriods.forEach((period) => {
      const [day, month, year] = period.endDate
        .split(" ")[0]
        .split("/")
        .map(Number);
      const date = new Date(year, month - 1, day);
      timelineData.push({
        date: date.toISOString().split("T")[0],
        gapHours: period.gapHours,
      });
    });

    return {
      silentPeriods,
      gapDistribution,
      reviverStats: reviverStatsArray,
      timelineData,
      stats: {
        totalSilentPeriods: silentPeriods.length,
        avgGap,
        longestGap,
        totalRevivals,
      },
    };
  }, [messages, persons]);

  if (!silentData || silentData.silentPeriods.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
          Silent Periods Analysis
        </h3>
        <p className="text-sm text-muted-foreground">
          No significant silent periods found (4+ hours with no messages).
        </p>
      </div>
    );
  }

  // Gap distribution chart
  const gapLabels = [
    "4-8 hours",
    "8-24 hours",
    "1-2 days",
    "2-7 days",
    "1+ weeks",
  ];
  const gapData = {
    labels: gapLabels,
    datasets: [
      {
        label: "Number of Silent Periods",
        data: gapLabels.map(
          (label) => silentData.gapDistribution.get(label) || 0,
        ),
        backgroundColor: "#FF6384",
        borderColor: "#FF6384",
        borderWidth: 2,
      },
    ],
  };

  // Reviver statistics chart
  const reviverData = {
    labels: silentData.reviverStats.map((stat) => stat.person),
    datasets: [
      {
        label: "Conversations Revived",
        data: silentData.reviverStats.map((stat) => stat.revivals),
        backgroundColor: "#36A2EB",
        borderColor: "#36A2EB",
        borderWidth: 2,
      },
    ],
  };

  // Timeline chart (last 50 silent periods for readability)
  const recentTimelineData = silentData.timelineData.slice(-50);
  const timelineChartData = {
    labels: recentTimelineData.map((d) => d.date),
    datasets: [
      {
        label: "Silent Period Duration (hours)",
        data: recentTimelineData.map((d) => d.gapHours),
        borderColor: "#FFCE56",
        backgroundColor: "rgba(255, 206, 86, 0.1)",
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const gapOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const count = context.parsed.y;
            const total = silentData.stats.totalSilentPeriods;
            const percentage = ((count / total) * 100).toFixed(1);
            return `${count} periods (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Number of Periods" },
      },
    },
  };

  const reviverOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const stat = silentData.reviverStats[context.dataIndex];
            return [
              `${stat.revivals} revivals`,
              `${stat.percentage.toFixed(1)}% of total`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Conversations Revived" },
      },
    },
  };

  const timelineOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const hours = context.parsed.y;
            const days = Math.floor(hours / 24);
            const remainingHours = Math.round(hours % 24);
            return days > 0
              ? `${days}d ${remainingHours}h silent period`
              : `${remainingHours}h silent period`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Silent Period Duration (hours)" },
        ticks: {
          callback: function (value: any) {
            const hours = Number(value);
            const days = Math.floor(hours / 24);
            return days > 0 ? `${days}d` : `${hours}h`;
          },
        },
      },
      x: {
        title: { display: true, text: "Date" },
        ticks: { maxTicksLimit: 10 },
      },
    },
  };

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Silent Periods Analysis
      </h3>
      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Analysis of conversation gaps (4+ hours) and who revives conversations
        </p>
        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
          <div>
            <strong>Silent Period Statistics:</strong>
            <div>Total periods: {silentData.stats.totalSilentPeriods}</div>
            <div>
              Average gap: {(silentData.stats.avgGap / 24).toFixed(1)} days
            </div>
            <div>
              Longest gap: {(silentData.stats.longestGap / 24).toFixed(1)} days
            </div>
          </div>
          <div>
            <strong>Top Conversation Revivers:</strong>
            {silentData.reviverStats.slice(0, 3).map((stat) => (
              <div key={stat.person}>
                {stat.person}: {stat.revivals} ({stat.percentage.toFixed(1)}%)
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-medium">
              Silent Period Duration Distribution
            </h4>
            <Bar data={gapData} options={gapOptions} />
          </div>
          <div>
            <h4 className="mb-2 text-xs font-medium">
              Who Revives Conversations
            </h4>
            <Bar data={reviverData} options={reviverOptions} />
          </div>
        </div>

        {recentTimelineData.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-medium">
              Silent Periods Timeline{" "}
              {recentTimelineData.length < silentData.timelineData.length &&
                `(Last ${recentTimelineData.length} periods)`}
            </h4>
            <Line data={timelineChartData} options={timelineOptions} />
          </div>
        )}
      </div>
    </>
  );
};
