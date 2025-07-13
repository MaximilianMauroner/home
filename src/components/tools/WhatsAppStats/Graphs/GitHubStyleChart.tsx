import { useState, useMemo } from "react";
import type { Message } from "../db";
import type { TooltipState } from "./types";

interface GitHubStyleChartProps {
  messages: Message[];
  year: number;
}

export const GitHubStyleChart = ({ messages, year }: GitHubStyleChartProps) => {
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
    const scale = count / 200;
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
