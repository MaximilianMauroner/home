import type { Message, Person } from "./db";
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
import {
  GitHubStyleChart,
  MessagesPerPerson,
  WordsPerPerson,
  MediaMessagesPerPerson,
  ActivityByTime,
  ActivityByDay,
  EmojiActivity,
  WordActivity,
  RunningAverageMessages,
  ResponseTimeAnalysis,
  ConversationStarters,
  ThreadLengthDistribution,
  SilentPeriods,
  EMOJI_PATTERN,
} from "./Graphs";

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
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <RunningAverageMessages messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <EmojiActivity messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <WordActivity messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <ResponseTimeAnalysis messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <ConversationStarters messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <ThreadLengthDistribution messages={messages} persons={persons} />
        </div>
        <div className="col-span-2 rounded-lg border p-1 sm:p-4">
          <SilentPeriods messages={messages} persons={persons} />
        </div>
      </div>
    </>
  );
}
