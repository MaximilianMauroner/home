import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { GraphProps } from "./types";
import { dateFromMessage } from "../datetime";
import { splitConversationThreads } from "../conversationMetrics";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";

export const ThreadLengthDistribution = ({ messages }: GraphProps) => {
  const threadData = useMemo(() => {
    if (messages.length < 2) return null;

    const threads = splitConversationThreads(messages).map((thread) => {
      const startMessage = thread.messages[0];
      const endMessage = thread.messages[thread.messages.length - 1];
      const startDate = dateFromMessage(startMessage);
      const endDate = dateFromMessage(endMessage);
      const participants = new Set(
        thread.messages.map((message) => message.personId),
      );
      const durationHours =
        startDate && endDate
          ? Math.max(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60),
              0,
            )
          : 0;
      return {
        length: thread.messages.length,
        durationHours,
        participants,
      };
    });

    // Create length distribution buckets
    const lengthBuckets = new Map<string, number>();
    const durationBuckets = new Map<string, number>();

    threads.forEach((thread) => {
      // Length buckets
      let lengthBucket: string;
      if (thread.length === 1) lengthBucket = "1 message";
      else if (thread.length <= 5) lengthBucket = "2-5 messages";
      else if (thread.length <= 10) lengthBucket = "6-10 messages";
      else if (thread.length <= 20) lengthBucket = "11-20 messages";
      else if (thread.length <= 50) lengthBucket = "21-50 messages";
      else lengthBucket = "50+ messages";

      lengthBuckets.set(
        lengthBucket,
        (lengthBuckets.get(lengthBucket) || 0) + 1,
      );

      // Duration buckets
      let durationBucket: string;
      if (thread.durationHours < 0.5) durationBucket = "< 30 min";
      else if (thread.durationHours < 1) durationBucket = "30 min - 1 hour";
      else if (thread.durationHours < 2) durationBucket = "1-2 hours";
      else if (thread.durationHours < 4) durationBucket = "2-4 hours";
      else if (thread.durationHours < 8) durationBucket = "4-8 hours";
      else durationBucket = "8+ hours";

      durationBuckets.set(
        durationBucket,
        (durationBuckets.get(durationBucket) || 0) + 1,
      );
    });

    // Calculate statistics
    const avgLength =
      threads.reduce((sum, t) => sum + t.length, 0) / threads.length;
    const avgDuration =
      threads.reduce((sum, t) => sum + t.durationHours, 0) / threads.length;
    const sortedLengths = [...threads]
      .map((thread) => thread.length)
      .sort((a, b) => a - b);
    const midpoint = Math.floor(sortedLengths.length / 2);
    const medianLength =
      sortedLengths.length % 2 === 0
        ? (sortedLengths[midpoint - 1] + sortedLengths[midpoint]) / 2
        : sortedLengths[midpoint];
    const avgParticipants =
      threads.reduce((sum, t) => sum + t.participants.size, 0) / threads.length;

    return {
      threads,
      lengthBuckets,
      durationBuckets,
      stats: {
        totalThreads: threads.length,
        avgLength: avgLength,
        medianLength: medianLength,
        avgDuration: avgDuration,
        avgParticipants: avgParticipants,
      },
    };
  }, [messages]);

  if (!threadData || threadData.threads.length === 0) {
    return (
      <div>
        <ChartHeader
          title="Thread Length Distribution"
          assumption={CHART_ASSUMPTIONS.threadLength}
        />
        <p className="text-sm text-muted-foreground">
          Not enough data to analyze thread patterns.
        </p>
      </div>
    );
  }

  // Prepare length distribution chart
  const lengthLabels = [
    "1 message",
    "2-5 messages",
    "6-10 messages",
    "11-20 messages",
    "21-50 messages",
    "50+ messages",
  ];
  const lengthData = {
    labels: lengthLabels,
    datasets: [
      {
        label: "Number of Threads",
        data: lengthLabels.map(
          (label) => threadData.lengthBuckets.get(label) || 0,
        ),
        backgroundColor: "#36A2EB",
        borderColor: "#36A2EB",
        borderWidth: 2,
      },
    ],
  };

  // Prepare duration distribution chart
  const durationLabels = [
    "< 30 min",
    "30 min - 1 hour",
    "1-2 hours",
    "2-4 hours",
    "4-8 hours",
    "8+ hours",
  ];
  const durationData = {
    labels: durationLabels,
    datasets: [
      {
        label: "Number of Threads",
        data: durationLabels.map(
          (label) => threadData.durationBuckets.get(label) || 0,
        ),
        backgroundColor: "#FF6384",
        borderColor: "#FF6384",
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
            const count = context.parsed.y;
            const total = threadData.stats.totalThreads;
            const percentage = ((count / total) * 100).toFixed(1);
            return `${count} threads (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Threads",
        },
      },
      x: {
        title: {
          display: true,
          text: "Thread Length",
        },
      },
    },
  };

  const durationOptions = {
    ...options,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Threads",
        },
      },
      x: {
        title: {
          display: true,
          text: "Thread Duration",
        },
      },
    },
  };

  return (
    <>
      <ChartHeader
        title="Thread Length Distribution"
        assumption={CHART_ASSUMPTIONS.threadLength}
      />
      <div className="mb-4 text-sm text-muted-foreground">
        <p>Analysis of conversation thread lengths and durations</p>
        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
          <div>
            <strong>Thread Statistics:</strong>
            <div>Total threads: {threadData.stats.totalThreads}</div>
            <div>
              Avg length: {threadData.stats.avgLength.toFixed(1)} messages
            </div>
            <div>Median length: {threadData.stats.medianLength} messages</div>
          </div>
          <div>
            <strong>Duration & Participation:</strong>
            <div>
              Avg duration: {threadData.stats.avgDuration.toFixed(1)} hours
            </div>
            <div>
              Avg participants: {threadData.stats.avgParticipants.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-medium">
            Thread Length Distribution
          </h4>
          <Bar data={lengthData} options={options} />
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium">
            Thread Duration Distribution
          </h4>
          <Bar data={durationData} options={durationOptions} />
        </div>
      </div>
    </>
  );
};
