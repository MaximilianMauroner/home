import { useMemo } from "react";
import { Bar, Pie } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";

export const ConversationStarters = ({ messages, persons }: GraphProps) => {
  const conversationData = useMemo(() => {
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

    // Find conversation starts
    const conversationStarts = new Map<number, number>();
    const conversationDetails: { starter: number; gapHours: number }[] = [];

    // First message is always a conversation starter
    conversationStarts.set(sortedMessages[0].personId, 1);

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

      // Consider a conversation starter if:
      // 1. Gap is more than 4 hours, OR
      // 2. It's a different day and gap is more than 1 hour
      const isDifferentDay =
        prevDay !== currDay || prevMonth !== currMonth || prevYear !== currYear;
      const isConversationStart =
        gapHours > 4 || (isDifferentDay && gapHours > 1);

      if (isConversationStart) {
        const count = conversationStarts.get(currMsg.personId) || 0;
        conversationStarts.set(currMsg.personId, count + 1);
        conversationDetails.push({
          starter: currMsg.personId,
          gapHours,
        });
      }
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
        <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
          Conversation Starters
        </h3>
        <p className="text-sm text-muted-foreground">
          Not enough data to analyze conversation patterns.
        </p>
      </div>
    );
  }

  const colorMap = getParticipantColors(persons.map((p) => p.name));

  const pieData = {
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

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const stat = conversationData.stats[context.dataIndex];
            return [
              `${stat.starts} conversations started`,
              `${stat.percentage.toFixed(1)}% of total`,
              `Avg gap: ${stat.avgGapHours.toFixed(1)} hours`,
            ];
          },
        },
      },
    },
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
              `Avg gap: ${stat.avgGapHours.toFixed(1)} hours`,
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
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Conversation Starters
      </h3>
      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Who initiates conversations most often (after 4+ hour gaps or 1+ hour
          on different days)
        </p>
        <p className="mt-1">
          Total conversations identified: {conversationData.totalStarts}
        </p>
        <div className="mt-2 space-y-1">
          {conversationData.stats
            .sort((a, b) => b.starts - a.starts)
            .map((stat) => (
              <div key={stat.person} className="text-xs">
                <strong>{stat.person}</strong>: {stat.starts} conversations (
                {stat.percentage.toFixed(1)}%), avg gap{" "}
                {stat.avgGapHours.toFixed(1)} hours
              </div>
            ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-medium">Distribution</h4>
          <div className="aspect-square">
            <Pie data={pieData} options={pieOptions} />
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium">Count Comparison</h4>
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </>
  );
};
