import { useState, useMemo } from "react";
import type { Message } from "@/components/tools/WhatsAppStats/db";
import type { TooltipState } from "./types";
import { dateKeyFromMessage, enumerateDateKeys } from "../datetime";
import { ChartHeader } from "./ChartHeader";
import { CHART_ASSUMPTIONS } from "./chartAssumptions";

interface GitHubStyleChartProps {
  messages: Message[];
  year: number;
}

export const GitHubStyleChart = ({ messages, year }: GitHubStyleChartProps) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const getLevel = (count: number, maxCount: number) => {
    if (count === 0 || maxCount <= 0) return 0;
    return Math.min(6, Math.max(1, Math.ceil((count / maxCount) * 6)));
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

  const { messagesByDay, maxCount } = useMemo(() => {
    const days = new Map<string, number>();
    let max = 0;
    messages.forEach((message) => {
      const dateKey = dateKeyFromMessage(message);
      const count = (days.get(dateKey) || 0) + 1;
      days.set(dateKey, count);
      max = Math.max(max, count);
    });
    return { messagesByDay: days, maxCount: max };
  }, [messages]);

  const weeks = useMemo(() => {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    const dateKeys = enumerateDateKeys(startOfYear, endOfYear);
    const firstDayOffset = startOfYear.getDay();
    const weekCount = Math.ceil((dateKeys.length + firstDayOffset) / 7);
    const weeks: Array<
      Array<{ dateKey: string; date: Date; count: number } | null>
    > = Array.from({ length: weekCount }, () => Array(7).fill(null));

    dateKeys.forEach((dateKey, dayOfYear) => {
      const [dateYear, dateMonth, dateDay] = dateKey.split("-").map(Number);
      const date = new Date(dateYear, dateMonth - 1, dateDay);
      const weekIndex = Math.floor((dayOfYear + firstDayOffset) / 7);
      const weekdayIndex = date.getDay();
      weeks[weekIndex][weekdayIndex] = {
        dateKey,
        date,
        count: messagesByDay.get(dateKey) || 0,
      };
    });

    return weeks;
  }, [messagesByDay, year]);

  return (
    <>
      <ChartHeader
        title={`Message Activity (${year})`}
        assumption={CHART_ASSUMPTIONS.githubActivity}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Each square is one day. Darker green means more messages.</span>
        <div className="flex items-center gap-1" aria-label="Activity color scale">
          <span className="mr-1 text-xs">Less</span>
          {[0, 1, 2, 3, 4, 5, 6].map((level) => (
            <span
              key={level}
              className="wa-activity-cell h-3 w-3 rounded-sm"
              data-level={level}
            />
          ))}
          <span className="ml-1 text-xs">More</span>
        </div>
      </div>
      <div className="tool-scroll-area relative w-full overflow-x-auto pb-2">
        <div className="flex min-w-max justify-center gap-4">
          <div className="flex w-max gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid gap-1">
                {week.map((day, dayIndex) =>
                  day ? (
                    <div
                      key={day.dateKey}
                      className="wa-activity-cell h-3 w-3 rounded-sm"
                      data-level={getLevel(day.count, maxCount)}
                      title={`${formatDate(day.date)}: ${day.count} message${
                        day.count !== 1 ? "s" : ""
                      }`}
                      onMouseEnter={(e) =>
                        handleMouseEnter(e, day.date, day.count)
                      }
                      onMouseLeave={handleMouseLeave}
                    />
                  ) : (
                    <div
                      key={`empty-${weekIndex}-${dayIndex}`}
                      className="h-3 w-3"
                    />
                  ),
                )}
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
    </>
  );
};
