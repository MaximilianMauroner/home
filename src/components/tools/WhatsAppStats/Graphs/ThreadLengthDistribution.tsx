import { useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import type { GraphProps } from "./types";

export const ThreadLengthDistribution = ({ messages, persons }: GraphProps) => {
  const threadData = useMemo(() => {
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

    // Find thread boundaries and calculate thread lengths
    const threads: {
      length: number;
      durationHours: number;
      participants: Set<number>;
    }[] = [];
    let currentThread = {
      length: 1,
      startTime: sortedMessages[0],
      endTime: sortedMessages[0],
      participants: new Set([sortedMessages[0].personId]),
    };

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

      // End thread if gap is more than 4 hours or different day with 1+ hour gap
      const isDifferentDay =
        prevDay !== currDay || prevMonth !== currMonth || prevYear !== currYear;
      const isThreadEnd = gapHours > 4 || (isDifferentDay && gapHours > 1);

      if (isThreadEnd) {
        // Save current thread
        const startDate = new Date();
        const [startDay, startMonth, startYear] = currentThread.startTime.date
          .split("/")
          .map(Number);
        const [startHour, startMin] = currentThread.startTime.time
          .split(":")
          .map(Number);
        startDate.setFullYear(startYear, startMonth - 1, startDay);
        startDate.setHours(startHour, startMin, 0, 0);

        const endDate = new Date();
        const [endDay, endMonth, endYear] = currentThread.endTime.date
          .split("/")
          .map(Number);
        const [endHour, endMin] = currentThread.endTime.time
          .split(":")
          .map(Number);
        endDate.setFullYear(endYear, endMonth - 1, endDay);
        endDate.setHours(endHour, endMin, 0, 0);

        const durationHours =
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

        threads.push({
          length: currentThread.length,
          durationHours: Math.max(durationHours, 0.1), // Minimum 6 minutes
          participants: new Set(currentThread.participants),
        });

        // Start new thread
        currentThread = {
          length: 1,
          startTime: currMsg,
          endTime: currMsg,
          participants: new Set([currMsg.personId]),
        };
      } else {
        // Continue current thread
        currentThread.length++;
        currentThread.endTime = currMsg;
        currentThread.participants.add(currMsg.personId);
      }
    }

    // Don't forget the last thread
    if (currentThread.length > 0) {
      const startDate = new Date();
      const [startDay, startMonth, startYear] = currentThread.startTime.date
        .split("/")
        .map(Number);
      const [startHour, startMin] = currentThread.startTime.time
        .split(":")
        .map(Number);
      startDate.setFullYear(startYear, startMonth - 1, startDay);
      startDate.setHours(startHour, startMin, 0, 0);

      const endDate = new Date();
      const [endDay, endMonth, endYear] = currentThread.endTime.date
        .split("/")
        .map(Number);
      const [endHour, endMin] = currentThread.endTime.time
        .split(":")
        .map(Number);
      endDate.setFullYear(endYear, endMonth - 1, endDay);
      endDate.setHours(endHour, endMin, 0, 0);

      const durationHours =
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      threads.push({
        length: currentThread.length,
        durationHours: Math.max(durationHours, 0.1),
        participants: new Set(currentThread.participants),
      });
    }

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
    const medianLength =
      [...threads].sort((a, b) => a.length - b.length)[
        Math.floor(threads.length / 2)
      ]?.length || 0;
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
  }, [messages, persons]);

  if (!threadData || threadData.threads.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
          Thread Length Distribution
        </h3>
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
      <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
        Thread Length Distribution
      </h3>
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
