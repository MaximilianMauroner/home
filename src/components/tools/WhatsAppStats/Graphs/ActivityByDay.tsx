import { Line } from "react-chartjs-2";
import type { GraphProps } from "./types";

export const ActivityByDay = ({ messages, persons }: GraphProps) => {
  // Find the first and last message by date (not by index)
  const sortedMessages = [...messages].sort((a, b) => {
    const [aDay, aMonth, aYear] = a.date.split("/").map(Number);
    const [bDay, bMonth, bYear] = b.date.split("/").map(Number);
    const aDate = new Date(aYear, aMonth - 1, aDay);
    const bDate = new Date(bYear, bMonth - 1, bDay);
    return aDate.getTime() - bDate.getTime();
  });
  const firstMsg = sortedMessages[0];
  const lastMsg = sortedMessages[sortedMessages.length - 1];
  const [firstDay, firstMonth, firstYear] = firstMsg.date
    .split("/")
    .map(Number);
  const [lastDay, lastMonth, lastYear] = lastMsg.date.split("/").map(Number);
  const startOfYear = new Date(firstYear, firstMonth - 1, firstDay);
  const endOfYear = new Date(lastYear, lastMonth - 1, lastDay);

  // Prepare a map of dateKey (YYYY-MM-DD) to counts per person
  const messagesByDay: Record<string, Record<number, number>> = {};
  messages.forEach((msg) => {
    const [day, month, year] = msg.date.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    const dateKey = date.toISOString().split("T")[0];
    if (!messagesByDay[dateKey]) messagesByDay[dateKey] = {};
    messagesByDay[dateKey][msg.personId] =
      (messagesByDay[dateKey][msg.personId] || 0) + 1;
  });

  // Generate all days of the year
  const allDates: string[] = [];
  let d = new Date(startOfYear);
  while (d <= endOfYear) {
    allDates.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }

  // Prepare total messages per day and per participant for tooltip
  const totalMessagesPerDay = allDates.map((dateKey) =>
    Object.values(messagesByDay[dateKey] || {}).reduce((a, b) => a + b, 0),
  );

  // For tooltip: get breakdown per participant for a given day
  const getBreakdown = (dateKey: string) => {
    const dayData = messagesByDay[dateKey] || {};
    const total = Object.values(dayData).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return persons
      .map((p) => {
        const count = dayData[p.id] || 0;
        if (count === 0) return null;
        const share = ((count / total) * 100).toFixed(1);
        return `${p.name}: ${count} (${share}%)`;
      })
      .filter(Boolean);
  };

  // Only one dataset: total messages per day
  const data = {
    labels: allDates,
    datasets: [
      {
        label: "Total Messages",
        data: totalMessagesPerDay,
        fill: false,
        borderColor: "#36A2EB",
        backgroundColor: "#36A2EB",
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (ctx: any) => {
            const date = ctx[0]?.label;
            return date;
          },
          label: (ctx: any) => {
            const idx = ctx.dataIndex;
            const dateKey = allDates[idx];
            const total = totalMessagesPerDay[idx];
            if (total === 0) return "0 messages";
            const breakdown = getBreakdown(dateKey).filter(
              (b) => b !== null,
            ) as string[];
            return [
              `${total} messages`,
              ...(breakdown.length ? ["Breakdown: ", ...breakdown] : []),
            ];
          },
        },
      },
    },
    maintainAspectRatio: true,
    scales: {
      y: { beginAtZero: false },
    },
  };

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Messages Per Day (Total)
      </h3>
      <div className="mx-auto w-full">
        <Line data={data} options={options} />
      </div>
    </>
  );
};
