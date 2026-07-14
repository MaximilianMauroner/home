import { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";
import { dateFromMessage } from "../datetime";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";

export const MessagesPerPerson = ({ messages, persons }: GraphProps) => {
  const totalMessages = messages.length;

  const { messagesPerPerson, pieData, firstDate, lastDate } = useMemo(() => {
    const messagesPerPerson = new Map<number, number>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const message of messages) {
      const personId = message.personId;
      const count = messagesPerPerson.get(personId) || 0;
      messagesPerPerson.set(personId, count + 1);

      // Track min/max date
      const msgDate = dateFromMessage(message);
      if (msgDate) {
        if (!minDate || msgDate < minDate) minDate = msgDate;
        if (!maxDate || msgDate > maxDate) maxDate = msgDate;
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
    [messagesPerPerson, persons, firstDate, lastDate],
  );

  return (
    <>
      <ChartHeader
        title="Messages per Participant"
        assumption={CHART_ASSUMPTIONS.messagesPerPerson}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Total Messages: {totalMessages}
      </p>
      <div className="mx-auto aspect-square w-full">
        <Pie data={pieData} options={pieOptions} />
      </div>
    </>
  );
};
