import { Pie } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { getParticipantColors } from "./utils";

export const MediaMessagesPerPerson = ({ messages, persons }: GraphProps) => {
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
