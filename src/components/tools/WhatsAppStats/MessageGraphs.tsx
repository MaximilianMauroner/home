import type { Message, Person } from "./db";
import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
} from "chart.js";
import { Pie } from "react-chartjs-2";
import { Bar } from "react-chartjs-2";
import { Line } from "react-chartjs-2";

// Add emoji regex pattern at the top of the file
const EMOJI_PATTERN =
  /(?<!\d)[\p{Emoji_Presentation}\p{Emoji}\u{20E3}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}](?!\d)/gu;

export default function MessageGraphs({
  messages,
  persons,
}: {
  messages: Message[];
  persons: Person[];
}) {
  if (!messages || messages.length === 0) {
    return null;
  }
  const year = messages[0].year;

  const filteredMessages = messages.filter((e) => {
    // Filter out media messages and messages that only contain emojis (ignoring whitespace)
    return (
      e.text !== "<Media omitted>" &&
      e.text.replace(EMOJI_PATTERN, "").trim().length > 0
    );
  });

  return (
    <>
      <div className="mt-4 grid gap-4 overflow-x-scroll sm:mt-8 sm:gap-8 md:grid-cols-2">
        {/* Add this new section before other charts */}
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <div className="w-full overflow-x-auto">
            <GitHubStyleChart messages={messages} year={year} />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:mt-8 sm:gap-8 md:grid-cols-2">
        <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
          <MessagesPerPerson messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
          <WordsPerPerson messages={filteredMessages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
          <MediaMessagesPerPerson messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <ActivityByTime messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <ActivityByDay messages={messages} persons={persons} />
        </div>
      </div>
    </>
  );
}

type TooltipState = {
  text: string;
  x: number;
  y: number;
};

const GitHubStyleChart = ({
  messages,
  year,
}: {
  messages: Message[];
  year: number;
}) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const colorScale = [
    "#ebedf0", // 0 contributions
    "#9be9a8", // level 1
    "#40c463", // level 2
    "#30a14e", // level 3
    "#216e39", // level 4
    "#1b4c2a", // level 5
    "#0f2d19", // level 6
  ];

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const getColor = (count: number) => {
    if (count === 0) return colorScale[0];
    const scale = count / 100;
    if (scale <= 0.15) return colorScale[1];
    if (scale <= 0.3) return colorScale[2];
    if (scale <= 0.45) return colorScale[3];
    if (scale <= 0.6) return colorScale[4];
    if (scale <= 0.75) return colorScale[5];
    return colorScale[6];
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString(undefined, options);
  };

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    date: Date,
    count: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      text: `${formatDate(date)}: ${count} message${count !== 1 ? "s" : ""}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const messagesByDay = useMemo(() => {
    const days = new Map<string, number>();
    messages.forEach((message) => {
      const [day, month, year] = message.date.split("/").map(Number);
      const date = new Date(year, month - 1, day); // month is 0-based
      const dateKey = date.toISOString().split("T")[0];
      days.set(dateKey, (days.get(dateKey) || 0) + 1);
    });
    return days;
  }, [messages]);

  const weeks = useMemo(() => {
    const weeks = [];
    let currentDate = new Date(startOfYear);

    while (currentDate <= endOfYear) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        if (currentDate <= endOfYear) {
          const dateKey = currentDate.toISOString().split("T")[0];
          const count = messagesByDay.get(dateKey) || 0;
          week.push({ date: new Date(currentDate), count });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [messagesByDay, startOfYear, endOfYear]);

  return (
    <div className="col-span-2 rounded-lg border p-1 sm:p-4">
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Message Activity (Last Year)
      </h3>
      <div className="w-full overflow-x-auto">
        <div className="relative w-full overflow-x-auto">
          <div className="flex justify-center gap-4">
            <div className="grid-cols-53 grid w-max gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid gap-1">
                  {week.map((day, dayIndex) => (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: getColor(day.count) }}
                      onMouseEnter={(e) =>
                        handleMouseEnter(e, day.date, day.count)
                      }
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {tooltip && (
            <div
              className="pointer-events-none fixed z-50 rounded-md bg-black/90 px-2 py-1 text-xs text-white"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              {tooltip.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MessagesPerPerson = ({
  messages,
  persons,
}: {
  messages: Message[];
  persons: Person[];
}) => {
  const totalMessages = messages.length;

  const {
    messagesPerPerson,
    messagesPerDayPerPerson,
    pieData,
    firstDate,
    lastDate,
  } = useMemo(() => {
    const messagesPerPerson = new Map<number, number>();
    const messagesPerDayPerPerson = new Map<number, Map<string, number>>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const message of messages) {
      const personId = message.personId;
      const count = messagesPerPerson.get(personId) || 0;
      messagesPerPerson.set(personId, count + 1);

      // Track messages per day per person
      if (!messagesPerDayPerPerson.has(personId)) {
        messagesPerDayPerPerson.set(personId, new Map());
      }
      const dateKey = message.date;
      const dayMap = messagesPerDayPerPerson.get(personId)!;
      dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);

      // Track min/max date
      const [day, month, year] = message.date.split("/").map(Number);
      const msgDate = new Date(year, month - 1, day);
      if (!minDate || msgDate < minDate) minDate = msgDate;
      if (!maxDate || msgDate > maxDate) maxDate = msgDate;
    }

    const colorMap = getParticipantColors(persons.map((p) => p.name));
    const labels = persons.map((p) => p.name);
    const backgroundColor = persons.map((p) => colorMap[p.name].bg);
    const borderColor = persons.map((p) => colorMap[p.name].border);
    const pieData = {
      labels,
      datasets: [
        {
          label: "Messages per user",
          data: persons.map((p) => messagesPerPerson.get(p.id) || 0),
          backgroundColor,
          borderColor,
          borderWidth: 2,
        },
      ],
    };

    return {
      messagesPerPerson,
      messagesPerDayPerPerson,
      colorMap,
      labels,
      backgroundColor,
      borderColor,
      pieData,
      firstDate: minDate,
      lastDate: maxDate,
    };
  }, [messages, persons]);

  // Pie chart options with custom tooltip
  const pieOptions = useMemo(
    () => ({
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const personIdx = context.dataIndex;
              const person = persons[personIdx];
              const personId = person.id;
              const totalMsgs = messagesPerPerson.get(personId) || 0;
              // Messages per day (using full date range)
              let msgsPerDay = "0";
              if (firstDate && lastDate) {
                const msPerDay = 1000 * 60 * 60 * 24;
                // Add 1 to include both endpoints
                const totalDays = Math.max(
                  1,
                  Math.round(
                    (lastDate.getTime() - firstDate.getTime()) / msPerDay,
                  ) + 1,
                );
                msgsPerDay = (totalMsgs / totalDays).toFixed(2);
              }
              return [
                `${totalMsgs} messages`,
                `${msgsPerDay} Messages per day`,
              ];
            },
          },
        },
      },
    }),
    [messagesPerPerson, messagesPerDayPerPerson, persons, firstDate, lastDate],
  );

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Messages per Participant
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Total Messages: {totalMessages}
      </p>
      <div className="mx-auto aspect-square w-full">
        <Pie data={pieData} options={pieOptions} />
      </div>
    </>
  );
};

const WordsPerPerson = ({
  messages,
  persons,
}: {
  messages: Message[];
  persons: Person[];
}) => {
  let totalMessages = 0;

  const { messagesPerPerson, wordCountsPerPerson, pieData } = useMemo(() => {
    const messagesPerPerson = new Map<number, number>();
    const wordCountsPerPerson = new Map<number, number[]>();
    for (const message of messages) {
      const personId = message.personId;
      const count = messagesPerPerson.get(personId) || 0;
      const wordCount = message.text
        .replace(EMOJI_PATTERN, "")
        .trim()
        .split(/\s+/).length;
      totalMessages += wordCount;
      messagesPerPerson.set(personId, count + wordCount);

      if (!wordCountsPerPerson.has(personId)) {
        wordCountsPerPerson.set(personId, []);
      }
      wordCountsPerPerson.get(personId)!.push(wordCount);

      // Track messages per day per person
    }

    const colorMap = getParticipantColors(persons.map((p) => p.name));
    const labels = persons.map((p) => p.name);
    const backgroundColor = persons.map((p) => colorMap[p.name].bg);
    const borderColor = persons.map((p) => colorMap[p.name].border);
    const pieData = {
      labels,
      datasets: [
        {
          label: "Words per user",
          data: persons.map((p) => messagesPerPerson.get(p.id) || 0),
          backgroundColor,
          borderColor,
          borderWidth: 2,
        },
      ],
    };

    return {
      messagesPerPerson,
      wordCountsPerPerson,
      colorMap,
      labels,
      backgroundColor,
      borderColor,
      pieData,
    };
  }, [messages, persons]);

  // Pie chart options with custom tooltip
  const pieOptions = useMemo(
    () => ({
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const personIdx = context.dataIndex;
              const person = persons[personIdx];
              const personId = person.id;
              const totalWords = messagesPerPerson.get(personId) || 0;
              const wordCounts = wordCountsPerPerson.get(personId) || [];
              const numMessages = wordCounts.length;
              const avg =
                numMessages > 0 ? (totalWords / numMessages).toFixed(2) : "0";
              // Median calculation
              let median = "0";
              if (numMessages > 0) {
                const sorted = [...wordCounts].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                median =
                  sorted.length % 2 === 0
                    ? ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
                    : sorted[mid].toFixed(2);
              }
              // Messages per day
              return [
                `${totalWords} words`,
                `${avg} words/msg (average)`,
                `${median} words/msg (median)`,
              ];
            },
          },
        },
      },
    }),
    [messagesPerPerson, wordCountsPerPerson, persons],
  );

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Words per Participant
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Total Words: {totalMessages}
      </p>
      <div className="mx-auto aspect-square w-full">
        <Pie data={pieData} options={pieOptions} />
      </div>
    </>
  );
};

const MediaMessagesPerPerson = ({
  messages,
  persons,
}: {
  messages: Message[];
  persons: Person[];
}) => {
  let totalMedia = 0;
  const mediaMessagesPerPerson = new Map<number, number>();
  for (const message of messages) {
    if (message.text === "<Media omitted>") {
      const personId = message.personId;
      const count = mediaMessagesPerPerson.get(personId) || 0;
      mediaMessagesPerPerson.set(personId, count + 1);
      totalMedia += 1;
    }
  }

  const colorMap = getParticipantColors(persons.map((p) => p.name));
  const labels = persons.map((p) => p.name);
  const backgroundColor = persons.map((p) => colorMap[p.name].bg);
  const borderColor = persons.map((p) => colorMap[p.name].border);

  const pieData = {
    labels,
    datasets: [
      {
        label: "Media messages per user",
        data: persons.map((p) => mediaMessagesPerPerson.get(p.id) || 0),
        backgroundColor,
        borderColor,
        borderWidth: 2,
      },
    ],
  };

  const pieOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const personIdx = context.dataIndex;
            const person = persons[personIdx];
            const personId = person.id;
            const totalMediaMsgs = mediaMessagesPerPerson.get(personId) || 0;
            return [`${totalMediaMsgs} media messages`];
          },
        },
      },
    },
  };

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Media Messages per Participant
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Total Media Messages: {totalMedia}
      </p>
      <div className="mx-auto aspect-square w-full">
        <Pie data={pieData} options={pieOptions} />
      </div>
    </>
  );
};

const ActivityByTime = ({
  messages,
  persons,
}: {
  messages: Message[];
  persons: Person[];
}) => {
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

const ActivityByDay = ({
  messages,
  persons,
}: {
  messages: Message[];
  persons: Person[];
}) => {
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

const getParticipantColors = (participantList: string[]) => {
  const colors = [
    { bg: "rgba(255, 99, 132, 0.5)", border: "rgba(255, 99, 132, 1)" },
    { bg: "rgba(54, 162, 235, 0.5)", border: "rgba(54, 162, 235, 1)" },
    { bg: "rgba(255, 206, 86, 0.5)", border: "rgba(255, 206, 86, 1)" },
    { bg: "rgba(75, 192, 192, 0.5)", border: "rgba(75, 192, 192, 1)" },
    { bg: "rgba(153, 102, 255, 0.5)", border: "rgba(153, 102, 255, 1)" },
    { bg: "rgba(255, 159, 64, 0.5)", border: "rgba(255, 159, 64, 1)" },
  ];

  return participantList.reduce(
    (acc, participant, index) => {
      acc[participant] = colors[index % colors.length];
      return acc;
    },
    {} as Record<string, { bg: string; border: string }>,
  );
};
