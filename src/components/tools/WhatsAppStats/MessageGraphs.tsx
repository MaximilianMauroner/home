import type { Message, Person } from "./db";
import type { ReactNode } from "react";
import { isTextualMessage } from "./messageClassification";
import {
  GitHubStyleChart,
  ParticipantDistribution,
  ActivityByTime,
  ActivityByDay,
  EmojiActivity,
  WordActivity,
  RunningAverageMessages,
  ResponseTimeAnalysis,
  ConversationStarters,
  ThreadLengthDistribution,
  SilentPeriods,
  ConversationInsights,
} from "./Graphs";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "participants", label: "Participants" },
  { id: "timing", label: "Timing" },
  { id: "language", label: "Language" },
  { id: "dynamics", label: "Dynamics" },
];

function ChartSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 text-lg font-semibold tracking-tight sm:text-xl">
        {title}
      </h2>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function ChartCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border p-3 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export default function MessageGraphs({
  messages,
  persons,
}: {
  messages: Message[];
  persons: Person[];
}) {
  if (!messages || messages.length === 0) {
    return (
      <div className="mt-4 rounded-lg border p-4 text-sm text-muted-foreground">
        No messages found for this chat and year.
      </div>
    );
  }
  const year = messages[0].year;

  const filteredMessages = messages.filter((e) => {
    // Filter out media/deleted placeholders and emoji-only messages.
    return isTextualMessage(e.text);
  });

  return (
    <div className="mt-6 space-y-8 sm:mt-10">
      <nav
        aria-label="Stats sections"
        className="sticky top-20 z-20 -mx-2 overflow-x-auto border-y border-border/80 bg-background/90 px-2 py-2 backdrop-blur dark:border-neutral-800 dark:bg-background/90"
      >
        <div className="flex min-w-max gap-2">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      <ChartSection id="overview" title="Overview">
        <ChartCard className="lg:col-span-2">
          <GitHubStyleChart messages={messages} year={year} />
        </ChartCard>
        <ChartCard className="lg:col-span-2">
          <ConversationInsights messages={messages} persons={persons} />
        </ChartCard>
      </ChartSection>

      <ChartSection id="participants" title="Participant Balance">
        <ChartCard className="lg:col-span-2">
          <ParticipantDistribution messages={messages} persons={persons} />
        </ChartCard>
      </ChartSection>

      <ChartSection id="timing" title="Timing Patterns">
        <ChartCard className="lg:col-span-2">
          <ActivityByTime messages={messages} persons={persons} />
        </ChartCard>
        <ChartCard className="lg:col-span-2">
          <ActivityByDay messages={messages} persons={persons} />
        </ChartCard>
        <ChartCard className="lg:col-span-2">
          <RunningAverageMessages messages={messages} persons={persons} />
        </ChartCard>
      </ChartSection>

      <ChartSection id="language" title="Language And Emoji">
        <ChartCard className="lg:col-span-2">
          <EmojiActivity messages={messages} persons={persons} />
        </ChartCard>
        <ChartCard className="lg:col-span-2">
          <WordActivity messages={filteredMessages} persons={persons} />
        </ChartCard>
      </ChartSection>

      <ChartSection id="dynamics" title="Conversation Dynamics">
        <ChartCard>
          <ResponseTimeAnalysis messages={messages} persons={persons} />
        </ChartCard>
        <ChartCard>
          <ConversationStarters messages={messages} persons={persons} />
        </ChartCard>
        <ChartCard>
          <ThreadLengthDistribution messages={messages} persons={persons} />
        </ChartCard>
        <ChartCard>
          <SilentPeriods messages={messages} persons={persons} />
        </ChartCard>
      </ChartSection>
    </div>
  );
}
