import { useState, useMemo, useEffect } from "react";
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
import { Bar, Pie, Line } from "react-chartjs-2";
import { COMMON_WORDS } from "@/lib/words";
import JSZip from "jszip";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

// Add emoji regex pattern at the top of the file
const EMOJI_PATTERN =
  /[\p{Emoji_Presentation}\p{Emoji}\u{20E3}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu;

interface SavedState {
  participants: string[];
  messageStats: { [key: string]: number };
  timeStats: { [key: string]: number };
  dateStats: { [key: string]: number };
  topDays: { date: string; count: number }[];
  wordStats: { [key: string]: number };
  topWords: { word: string; count: number }[];
  fileName: string;
}

interface MessageStats {
  [participant: string]: number;
}

interface TimeStats {
  [hour: string]: number;
}

interface DateStats {
  [date: string]: number;
}

interface DateStatsWithYears {
  stats: DateStats;
  availableYears: number[];
}

interface WordStats {
  [participant: string]: number;
}

interface WordFrequency {
  word: string;
  count: number;
}

interface DayActivity {
  date: string;
  count: number;
}

interface MediaStats {
  [participant: string]: number;
}

export default function WhatsappStats() {
  // Add new state for raw messages
  const [rawMessages, setRawMessages] = useState<string[]>([]);
  // Add new state for selected year
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<string[]>([]);
  const [messageStats, setMessageStats] = useState<MessageStats>({});
  const [timeStats, setTimeStats] = useState<TimeStats>({});
  const [dateStats, setDateStats] = useState<DateStats>({});
  const [topDays, setTopDays] = useState<DayActivity[]>([]);
  const [wordStats, setWordStats] = useState<WordStats>({});
  const [topWords, setTopWords] = useState<WordFrequency[]>([]);
  const [mediaStats, setMediaStats] = useState<MediaStats>({});
  const [allWords, setAllWords] = useState<WordFrequency[]>([]);
  const [customWordLength, setCustomWordLength] = useState(8);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Combined getAvailableYears function to handle both input types
  const getAvailableYears = (input: string[] | DateStats): number[] => {
    const years = new Set<number>();

    if (Array.isArray(input)) {
      // Handle array of messages
      input.forEach((msg) => {
        const dateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1].split("/")[2]);
          if (!isNaN(year)) {
            years.add(year);
          }
        }
      });
    } else {
      // Handle DateStats object
      Object.keys(input).forEach((date) => {
        const year = parseInt(date.split("/")[2]);
        if (!isNaN(year)) {
          years.add(year);
        }
      });
    }

    return Array.from(years).sort((a, b) => b - a);
  };

  // Update processTextData to store raw messages first
  const processTextData = (text: string) => {
    const lines = text.split("\n");
    const participantsList = extractParticipants(lines);
    const filtered = filterMessages(lines, participantsList);
    setRawMessages(filtered); // Store raw messages
    setParticipants(participantsList);

    // Get available years and set initial year
    const years = getAvailableYears(filtered);
    setAvailableYears(years);
    if (years.length > 0) {
      setSelectedYear(years[0]);
      const yearMessages = filterMessagesByYear(filtered, years[0]);
      analyzeMessages(yearMessages, participantsList);
    }
  };

  useEffect(() => {
    // If no analyzed data, try to load raw text
    const savedText = localStorage.getItem("whatsapp-stats-raw");
    if (savedText) {
      try {
        processTextData(savedText);
      } catch (e) {
        console.error("Error processing saved text:", e);
        localStorage.removeItem("whatsapp-stats-raw");
      }
    }
  }, []);

  const clearSavedData = () => {
    localStorage.removeItem("whatsapp-stats-raw");
    setFile(null);
    setError(null);
    setContent(null);
    setParticipants([]);
    setFilteredMessages([]);
    setMessageStats({});
    setTimeStats({});
    setDateStats({});
    setTopDays([]);
    setWordStats({});
    setTopWords([]);
    setMediaStats({});
  };

  const extractParticipants = (lines: string[]) => {
    const uniqueParticipants = new Set<string>();

    lines.forEach((line) => {
      if (line.includes(": ")) {
        const [datePlusUser] = line.split(": ");
        if (datePlusUser && datePlusUser.includes(" - ")) {
          const user = datePlusUser.split(" - ")[1].trim();
          uniqueParticipants.add(user);
        }
      }
    });

    const participantsList = Array.from(uniqueParticipants);
    setParticipants(participantsList);
    return participantsList;
  };

  const filterMessages = (lines: string[], participants: string[]) => {
    return lines.filter((line) => {
      if (!line.includes(": ")) return false;
      const [datePlusUser] = line.split(": ");
      if (!datePlusUser || !datePlusUser.includes(" - ")) return false;
      const user = datePlusUser.split(" - ")[1].trim();
      return participants.includes(user);
    });
  };

  // Add utility functions for filtering data by year
  const filterMessagesByYear = (messages: string[], year: number) => {
    return messages.filter((msg) => {
      const dateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dateMatch) {
        const msgYear = parseInt(dateMatch[1].split("/")[2]);
        return msgYear === year;
      }
      return false;
    });
  };

  // Update year change handler
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const yearMessages = filterMessagesByYear(rawMessages, year);
    analyzeMessages(yearMessages, participants);
  };

  // Update useEffect for year changes
  useEffect(() => {
    if (rawMessages.length > 0) {
      const yearMessages = filterMessagesByYear(rawMessages, selectedYear);
      analyzeMessages(yearMessages, participants);
    }
  }, [selectedYear]);

  // Remove year filtering from analyzeMessages as it now receives pre-filtered data
  const analyzeMessages = (messages: string[], participants: string[]) => {
    const stats: MessageStats = {};
    const hourStats: TimeStats = {};
    const dailyStats: DateStats = {};
    const wordCountStats: WordStats = {};
    const wordFrequency: { [word: string]: number } = {};
    const mediaCountStats: MediaStats = {};

    participants.forEach((p) => (stats[p] = 0));
    for (let i = 0; i < 24; i++) {
      hourStats[i] = 0;
    }
    participants.forEach((p) => (mediaCountStats[p] = 0));

    messages.forEach((msg) => {
      // Count messages per user
      const [datePlusUser] = msg.split(": ");
      if (datePlusUser && datePlusUser.includes(" - ")) {
        const user = datePlusUser.split(" - ")[1].trim();
        stats[user] = (stats[user] || 0) + 1;
      }

      // Count messages per hour
      try {
        const timeMatch = msg.match(/\d{1,2}:\d{2}/);
        if (timeMatch) {
          const hour = parseInt(timeMatch[0].split(":")[0]);
          hourStats[hour] = (hourStats[hour] || 0) + 1;
        }
      } catch (e) {
        console.error("Error parsing time:", e);
      }

      // Count messages per day
      try {
        const dateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (dateMatch) {
          const date = dateMatch[1];
          dailyStats[date] = (dailyStats[date] || 0) + 1;
        }
      } catch (e) {
        console.error("Error parsing date:", e);
      }

      // Update word counting logic with enhanced filtering
      const [userInfo, messageContent] = msg.split(": ");
      if (userInfo && messageContent && userInfo.includes(" - ")) {
        const user = userInfo.split(" - ")[1].trim();

        // Skip media messages and filter out emojis
        if (!messageContent.includes("<Media omitted>")) {
          const cleanMessage = messageContent
            .replace(EMOJI_PATTERN, "")
            .replace("<This message was edited>", "");

          const words = cleanMessage
            .toLowerCase()
            .split(/\s+/)
            .filter(
              (word) =>
                word.length > 2 &&
                !COMMON_WORDS.has(word) &&
                !/^\d+$/.test(word) &&
                !word.startsWith("http") &&
                word !== "media" &&
                word !== "omitted" &&
                word !== "message" &&
                word !== "edited" &&
                word !== "this",
            );

          wordCountStats[user] = (wordCountStats[user] || 0) + words.length;

          words.forEach((word) => {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
          });
        }
      }

      // Count media messages per user
      if (msg.includes("<Media omitted>")) {
        const [userInfo] = msg.split(": ");
        if (userInfo && userInfo.includes(" - ")) {
          const user = userInfo.split(" - ")[1].trim();
          mediaCountStats[user] = (mediaCountStats[user] || 0) + 1;
        }
      }
    });

    // Sort and get top 10 most active days
    const sortedDays = Object.entries(dailyStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([date, count]) => ({ date, count }));

    // Get all words sorted by frequency
    const sortedWords = Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .map(([word, count]) => ({ word, count }));

    setAllWords(sortedWords);
    setTopWords(sortedWords.slice(0, 10));
    setMessageStats(stats);
    setTimeStats(hourStats);
    setDateStats(dailyStats);
    setTopDays(sortedDays);
    setWordStats(wordCountStats);
    setMediaStats(mediaCountStats);
  };

  const extractTextFromZip = async (zipFile: File): Promise<string | null> => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipFile);

      // Find the first .txt file in the zip
      const txtFile = Object.values(contents.files).find(
        (file) => !file.dir && file.name.endsWith(".txt"),
      );

      if (!txtFile) {
        setError("No text file found in zip archive");
        return null;
      }

      return await txtFile.async("text");
    } catch (err) {
      console.error("Error extracting zip:", err);
      setError("Error extracting zip file");
      return null;
    }
  };

  const readFileContent = async (file: File) => {
    try {
      let text: string;
      if (file.name.endsWith(".zip")) {
        const extractedText = await extractTextFromZip(file);
        if (!extractedText) return;
        text = extractedText;
      } else {
        text = await file.text();
      }

      localStorage.setItem("whatsapp-stats-raw", text);
      processTextData(text);
    } catch (err) {
      setError("Error reading file content");
      console.error("Error reading file:", err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (
      !selectedFile.name.endsWith(".txt") &&
      !selectedFile.name.endsWith(".zip")
    ) {
      setError("Please upload a .txt or .zip file");
      return;
    }

    setError(null);
    setFile(selectedFile);
    await readFileContent(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (
      !droppedFile.name.endsWith(".txt") &&
      !droppedFile.name.endsWith(".zip")
    ) {
      setError("Please upload a .txt or .zip file");
      return;
    }

    setError(null);
    setFile(droppedFile);
    await readFileContent(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Add participant color mapping
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

  // Update pie chart data definitions
  const chartData = useMemo(() => {
    const colorMap = getParticipantColors(participants);
    return {
      labels: Object.keys(messageStats),
      datasets: [
        {
          label: "Messages per user",
          data: Object.values(messageStats),
          backgroundColor: Object.keys(messageStats).map((p) => colorMap[p].bg),
          borderColor: Object.keys(messageStats).map((p) => colorMap[p].border),
          borderWidth: 1,
        },
      ],
    };
  }, [messageStats, participants]);

  const wordChartData = useMemo(() => {
    const colorMap = getParticipantColors(participants);
    return {
      labels: Object.keys(wordStats),
      datasets: [
        {
          label: "Words per user",
          data: Object.values(wordStats),
          backgroundColor: Object.keys(wordStats).map((p) => colorMap[p].bg),
          borderColor: Object.keys(wordStats).map((p) => colorMap[p].border),
          borderWidth: 1,
        },
      ],
    };
  }, [wordStats, participants]);

  const mediaChartData = useMemo(() => {
    const colorMap = getParticipantColors(participants);
    return {
      labels: Object.keys(mediaStats),
      datasets: [
        {
          label: "Media messages per user",
          data: Object.values(mediaStats),
          backgroundColor: Object.keys(mediaStats).map((p) => colorMap[p].bg),
          borderColor: Object.keys(mediaStats).map((p) => colorMap[p].border),
          borderWidth: 1,
        },
      ],
    };
  }, [mediaStats, participants]);

  const timeChartData = useMemo(
    () => ({
      labels: Object.keys(timeStats),
      datasets: [
        {
          label: "Messages per hour",
          data: Object.values(timeStats),
          fill: true,
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgb(75, 192, 192)",
          tension: 0.4,
        },
      ],
    }),
    [timeStats],
  );

  // Add function to filter data by year
  const filterDataByYear = (data: DateStats, year: number): DateStats => {
    return Object.entries(data).reduce((filtered, [date, count]) => {
      const dateYear = parseInt(date.split("/")[2]);
      if (dateYear === year) {
        filtered[date] = count;
      }
      return filtered;
    }, {} as DateStats);
  };

  const dailyChartData = useMemo(
    () => ({
      labels: Object.keys(filterDataByYear(dateStats, selectedYear)),
      datasets: [
        {
          label: "Messages per day",
          data: Object.values(filterDataByYear(dateStats, selectedYear)),
          fill: true,
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgb(75, 192, 192)",
          tension: 0.4,
        },
      ],
    }),
    [dateStats, selectedYear],
  );

  const topDaysChartData = useMemo(
    () => ({
      labels: topDays.map((day) => day.date),
      datasets: [
        {
          label: "Messages",
          data: topDays.map((day) => day.count),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    }),
    [topDays],
  );

  const topWordsChartData = useMemo(
    () => ({
      labels: topWords.map((item) => item.word),
      datasets: [
        {
          label: "Word frequency",
          data: topWords.map((item) => item.count),
          backgroundColor: "rgba(147, 51, 234, 0.5)",
          borderColor: "rgb(147, 51, 234)",
          borderWidth: 1,
        },
      ],
    }),
    [topWords],
  );

  const longWordsChartData = useMemo(
    () => ({
      labels: allWords
        .filter((item) => item.word.length >= 5)
        .slice(0, 10)
        .map((item) => item.word),
      datasets: [
        {
          label: "Long word frequency",
          data: allWords
            .filter((item) => item.word.length >= 5)
            .slice(0, 10)
            .map((item) => item.count),
          backgroundColor: "rgba(99, 102, 241, 0.5)",
          borderColor: "rgb(99, 102, 241)",
          borderWidth: 1,
        },
      ],
    }),
    [allWords],
  );

  const veryLongWordsChartData = useMemo(
    () => ({
      labels: allWords
        .filter((item) => item.word.length >= 10)
        .slice(0, 10)
        .map((item) => item.word),
      datasets: [
        {
          label: "Very long word frequency",
          data: allWords
            .filter((item) => item.word.length >= 10)
            .slice(0, 10)
            .map((item) => item.count),
          backgroundColor: "rgba(220, 38, 38, 0.5)",
          borderColor: "rgb(220, 38, 38)",
          borderWidth: 1,
        },
      ],
    }),
    [allWords],
  );

  const customLengthWordsChartData = useMemo(
    () => ({
      labels: allWords
        .filter((item) => item.word.length >= customWordLength)
        .slice(0, 10)
        .map((item) => item.word),
      datasets: [
        {
          label: `Words ≥${customWordLength} letters`,
          data: allWords
            .filter((item) => item.word.length >= customWordLength)
            .slice(0, 10)
            .map((item) => item.count),
          backgroundColor: "rgba(234, 88, 12, 0.5)",
          borderColor: "rgb(234, 88, 12)",
          borderWidth: 1,
        },
      ],
    }),
    [allWords, customWordLength],
  );

  // Add shared chart options for better mobile display
  const sharedBarChartOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: { beginAtZero: true },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const sharedLineChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: { beginAtZero: true },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  // Add these helper functions
  const getTotalMessages = () => {
    return Object.values(messageStats).reduce((sum, count) => sum + count, 0);
  };

  const getTotalWords = () => {
    return Object.values(wordStats).reduce((sum, count) => sum + count, 0);
  };

  return (
    <div
      className="rounded-lg border-2 border-dashed p-4 text-center sm:p-8"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".txt,.zip"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="cursor-pointer text-primary hover:underline"
      >
        Choose a file
      </label>
      <p className="mt-2 text-sm text-muted-foreground">
        or drag and drop your WhatsApp chat export here
      </p>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {file && (
        <p className="mt-2 text-sm text-green-500">
          Selected file: {file.name}
        </p>
      )}
      {participants.length > 0 && (
        <div className="mt-4 text-left">
          <h3 className="font-semibold">Chat Participants:</h3>
          <ul className="mt-2 list-disc pl-5">
            {participants.map((participant, index) => (
              <li key={index} className="text-sm">
                {participant}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Object.keys(messageStats).length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between sm:mb-8">
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              onClick={clearSavedData}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 sm:px-4 sm:py-2"
            >
              Clear Data
            </button>
          </div>
          <div className="mt-4 grid gap-4 overflow-x-scroll sm:mt-8 sm:gap-8 md:grid-cols-2">
            {/* Add this new section before other charts */}
            <div className="col-span-2 rounded-lg border p-1 sm:p-4">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Message Activity (Last Year)
              </h3>
              <div className="w-full overflow-x-auto">
                <GitHubStyleChart
                  data={dateStats}
                  selectedYear={selectedYear}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:mt-8 sm:gap-8 md:grid-cols-2">
            <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Messages per Participant
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Total Messages: {getTotalMessages().toLocaleString()}
              </p>
              <div className="mx-auto aspect-square w-full">
                <Pie data={chartData} />
              </div>
            </div>

            <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Words per Participant
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Total Words: {getTotalWords().toLocaleString()}
              </p>
              <div className="mx-auto aspect-square w-full">
                <Pie data={wordChartData} />
              </div>
            </div>

            <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Media Messages per Participant
              </h3>
              <div className="mx-auto aspect-square w-full">
                <Pie data={mediaChartData} />
              </div>
            </div>

            <div className="col-span-2 rounded-lg border p-1 sm:p-4">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Activity by Hour
              </h3>
              <div>
                <Line data={timeChartData} options={sharedLineChartOptions} />
              </div>
            </div>

            <div className="col-span-2 rounded-lg border p-1 sm:p-4">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Messages over Time
              </h3>
              <div>
                <Line data={dailyChartData} options={sharedLineChartOptions} />
              </div>
            </div>

            {/* Bar Charts Section */}
            {[
              {
                title: "Most Active Days",
                data: topDaysChartData,
                cn: "col-span-2",
              },
              {
                title: "Most Used Words",
                data: topWordsChartData,
                cn: "col-span-2 md:col-span-1",
              },

              {
                title: "Most Used Long Words (>5 letters)",
                data: longWordsChartData,
                cn: "col-span-2 md:col-span-1",
              },
              {
                title: "Most Used Very Long Words (>10 letters)",
                data: veryLongWordsChartData,
                cn: "col-span-2 md:col-span-1",
              },
              {
                title: (
                  <div className="flex items-center justify-between">
                    <span>Words ≥{customWordLength} letters</span>
                    <input
                      type="number"
                      min="3"
                      max="20"
                      value={customWordLength}
                      onChange={(e) =>
                        setCustomWordLength(Number(e.target.value))
                      }
                      className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                ),
                data: customLengthWordsChartData,
                cn: "col-span-2 md:col-span-1",
              },
            ].map((chart, index) => (
              <div
                key={index}
                className={"rounded-lg border p-1 sm:p-4 " + chart.cn}
              >
                <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                  {chart.title}
                </h3>
                <div>
                  <Bar data={chart.data} options={sharedBarChartOptions} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface GitHubStyleChartProps {
  data: DateStats;
  selectedYear: number;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}
const GitHubStyleChart = ({ data, selectedYear }: GitHubStyleChartProps) => {
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

  const startOfYear = new Date(selectedYear, 0, 1);
  const endOfYear = new Date(selectedYear, 11, 31);

  const startDate = new Date(startOfYear);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const endDate = new Date(endOfYear);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const totalWeeks = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );

  const weeks = Array.from({ length: totalWeeks }, (_, weekIndex) => {
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + weekIndex * 7 + dayIndex);
      const dateStr = date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return { date, count: data[dateStr] || 0 };
    });
  });

  const maxValue = Math.max(...Object.values(data));

  const getColor = (count: number) => {
    if (count === 0) return colorScale[0];
    const scale = count / maxValue;
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

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="flex justify-center gap-4">
        <div className="grid-cols-53 grid w-max gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((item) => (
                <div
                  key={item.date.toISOString()}
                  className="aspect-square w-3 cursor-pointer rounded-sm transition-colors duration-200 hover:opacity-80"
                  style={{ backgroundColor: getColor(item.count) }}
                  onMouseEnter={(e) =>
                    handleMouseEnter(e, item.date, item.count)
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
  );
};
