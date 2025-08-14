import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { GraphProps } from "./types";

export const ActivityByDay = ({ messages, persons }: GraphProps) => {
  // UI state
  const [showMA, setShowMA] = useState(false);
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

  // Compute 3-day trailing moving average (uses available preceding days for first two points)
  const threeDayMA = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < totalMessagesPerDay.length; i++) {
      let sum = 0;
      let count = 0;
      for (let w = 0; w < 3; w++) {
        const idx = i - w;
        if (idx >= 0) {
          sum += totalMessagesPerDay[idx];
          count++;
        }
      }
      out.push(count > 0 ? sum / count : 0);
    }
    return out;
  }, [totalMessagesPerDay]);

  // Per-day color blending between two participants (persons[0] -> red, persons[1] -> blue)
  // Assumption: if exactly two participants, blend by share; otherwise fallback to a default color.
  const colorsForIndex = useMemo(() => {
    const hasTwo = persons.length === 2;
    const p1Id = persons[0]?.id;
    const p2Id = persons[1]?.id;
    const red = [239, 68, 68]; // tailwind red-500
    const blue = [59, 130, 246]; // tailwind blue-500

    const blend = (a: number[], b: number[], t: number) => {
      const r = Math.round(a[0] * (1 - t) + b[0] * t);
      const g = Math.round(a[1] * (1 - t) + b[1] * t);
      const bch = Math.round(a[2] * (1 - t) + b[2] * t);
      return `rgb(${r}, ${g}, ${bch})`;
    };

    return allDates.map((dateKey) => {
      const dayData = messagesByDay[dateKey] || {};
      const total = Object.values(dayData).reduce((a, b) => a + b, 0);
      if (!hasTwo || total === 0) return "#36A2EB"; // fallback
      const c1 = dayData[p1Id] || 0;
      const c2 = dayData[p2Id] || 0;
      const s = c2 + c1 === 0 ? 0.5 : c2 / (c1 + c2); // t toward blue
      return blend(red, blue, s);
    });
  }, [allDates, messagesByDay, persons]);

  // Build datasets (optionally include moving average)
  const baseDataset: any = {
    label: "Total Messages",
    data: totalMessagesPerDay,
    fill: false,
    // Color per-segment/point based on daily participant mix
    segment: {
      borderColor: (ctx: any) => colorsForIndex[ctx.p0DataIndex] ?? "#36A2EB",
    },
    borderColor: "#36A2EB",
    backgroundColor: "#36A2EB",
    pointBackgroundColor: colorsForIndex,
    pointBorderColor: colorsForIndex,
    tension: 0.2,
    pointRadius: 4,
    pointHoverRadius: 4,
  };

  const maDataset: any = {
    label: "3-Day MA",
    data: threeDayMA,
    fill: false,
    borderColor: "#f59e0b", // amber-500
    backgroundColor: "#f59e0b",
    tension: 0.25,
    pointRadius: 0,
    pointHoverRadius: 0,
    borderWidth: 2,
    borderDash: [6, 4],
  };

  const data = {
    labels: allDates,
    datasets: showMA ? [baseDataset, maDataset] : [baseDataset],
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
      <p className="mb-4 text-sm text-muted-foreground">
        Most Active Day:{" "}
        {(() => {
          const totals = data.datasets[0].data as number[];
          const max = Math.max(...totals);
          const idx = totals.findIndex((v: number) => v === max);
          return `${data.labels[idx]} (${max} messages)`;
        })()}
      </p>
      <label className="mb-2 flex items-center gap-2 text-sm sm:text-base">
        <input
          type="checkbox"
          className="h-4 w-4 accent-amber-500"
          checked={showMA}
          onChange={(e) => setShowMA(e.target.checked)}
        />
        Show 3-day moving average
      </label>
      <div className="mx-auto w-full">
        <Line data={data} options={options} />
      </div>
    </>
  );
};
