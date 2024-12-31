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

export default function WhatsappStats() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<string[]>([]);
  const [messageStats, setMessageStats] = useState<{ [key: string]: number }>(
    {},
  );
  const [timeStats, setTimeStats] = useState<{ [key: string]: number }>({});
  const [dateStats, setDateStats] = useState<{ [key: string]: number }>({});
  const [topDays, setTopDays] = useState<{ date: string; count: number }[]>([]);
  const [wordStats, setWordStats] = useState<{ [key: string]: number }>({});
  const [topWords, setTopWords] = useState<{ word: string; count: number }[]>(
    [],
  );
  const [mediaStats, setMediaStats] = useState<{ [key: string]: number }>({});
  const [allWords, setAllWords] = useState<{ word: string; count: number }[]>(
    [],
  );
  const [customWordLength, setCustomWordLength] = useState(8);

  const processTextData = (text: string) => {
    const lines = text.split("\n");
    const participantsList = extractParticipants(lines);
    const filtered = filterMessages(lines, participantsList);
    setFilteredMessages(filtered);
    analyzeMessages(filtered, participantsList);
    setContent(text);
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

  const analyzeMessages = (messages: string[], participants: string[]) => {
    const stats: { [key: string]: number } = {};
    const hourStats: { [key: string]: number } = {};
    const dailyStats: { [key: string]: number } = {};
    const wordCountStats: { [key: string]: number } = {};
    const wordFrequency: { [key: string]: number } = {};
    const mediaCountStats: { [key: string]: number } = {};

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

  const readFileContent = async (file: File) => {
    try {
      const text = await file.text();
      localStorage.setItem("whatsapp-stats-raw", text); // Save raw text
      processTextData(text);
    } catch (err) {
      setError("Error reading file content");
      console.error("Error reading file:", err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".txt")) {
      setError("Please upload a .txt file");
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

    if (!droppedFile.name.endsWith(".txt")) {
      setError("Please upload a .txt file");
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

  const dailyChartData = useMemo(
    () => ({
      labels: Object.keys(dateStats),
      datasets: [
        {
          label: "Messages per day",
          data: Object.values(dateStats),
          fill: true,
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgb(75, 192, 192)",
          tension: 0.4,
        },
      ],
    }),
    [dateStats],
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

  return (
    <div
      className="rounded-lg border-2 border-dashed p-4 text-center sm:p-8"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".txt"
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
          <div className="mb-4 flex justify-end sm:mb-8">
            <button
              onClick={clearSavedData}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 sm:px-4 sm:py-2"
            >
              Clear Data
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:mt-8 sm:gap-8 md:grid-cols-2">
            {/* Pie Charts Section */}
            <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Messages per Participant
              </h3>
              <div className="mx-auto aspect-square w-full">
                <Pie data={chartData} />
              </div>
            </div>

            <div className="col-span-2 rounded-lg border p-1 sm:p-4 md:col-span-1">
              <h3 className="mb-2 text-sm font-semibold sm:mb-4 sm:text-base">
                Words per Participant
              </h3>
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
