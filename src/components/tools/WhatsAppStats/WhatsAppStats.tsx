import { useCallback, useEffect, useState } from "react";
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
  isClearedAtom,
  showNamesAtom,
  whatsappDB,
  type Chat,
  type Message,
  type Person,
} from "./db";
import { HandlewhatsappData } from "./Upload";
import { compareMessagesByTimestamp, dateFromMessage } from "./datetime";

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

import { useAtom } from "jotai";
import MessageGraphs from "./MessageGraphs";

export default function WhatsappStats() {
  const [_, setIsCleared] = useAtom(isClearedAtom);
  const [showNames, setShowNames] = useAtom(showNamesAtom);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedChat, setSelectedChat] = useState<number>();
  const [chats, setChats] = useState<Chat[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [message, setMessages] = useState<Message[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);

  const selectedYearKey = (chatId: number) => `wa_selectedYear:${chatId}`;

  async function clearSavedData() {
    await whatsappDB.transaction(
      "rw",
      whatsappDB.chats,
      whatsappDB.persons,
      whatsappDB.messages,
      async () => {
        await whatsappDB.messages.clear();
        await whatsappDB.chats.clear();
        await whatsappDB.persons.clear();
      },
    );
    localStorage.removeItem("wa_selectedChat");
    localStorage.removeItem("wa_selectedYear");
    Object.keys(localStorage)
      .filter((key) => key.startsWith("wa_selectedYear:"))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem("showNames");
    setChats([]);
    setSelectedChat(undefined);
    setIsCleared(true);
    setMessages([]);
    setPersons([]);
    setAvailableYears([]);
    setSelectedYear(null);
    setShowNames(false);
  }

  const fetchYears = useCallback(
    async (chatId: number, preselectedYear?: number | null) => {
      const currentYear = new Date().getFullYear() + 1;
      const pairs = await whatsappDB.messages
        .where("[chatId+year]")
        .between([chatId, 2009], [chatId, currentYear])
        .uniqueKeys();

      const years = Array.from(
        new Set(
          pairs.map((pair) =>
            Array.isArray(pair) ? Number(pair[1]) : Number(pair),
          ),
        ),
      )
        .filter((year) => !Number.isNaN(year))
        .sort((a, b) => a - b);

      const selected =
        preselectedYear && years.includes(preselectedYear)
          ? preselectedYear
          : (years[years.length - 1] ?? null);

      return { selected, years };
    },
    [],
  );

  const fetchMessages = useCallback(async (chatId: number, year: number) => {
    const [messagesDB, personsDB] = await Promise.all([
      whatsappDB.messages.where({ chatId, year }).toArray(),
      whatsappDB.persons.where("chatId").equals(chatId).toArray(),
    ]);

    const sortedMessages = [...messagesDB].sort(compareMessagesByTimestamp);
    const activePersonIds = new Set(sortedMessages.map((msg) => msg.personId));
    return {
      messages: sortedMessages,
      persons: personsDB.filter((person) => activePersonIds.has(person.id)),
    };
  }, []);

  const fetchChatCount = useCallback(async (preSelectedId?: number | null) => {
    const chatsDB = await whatsappDB.chats.toArray();
    if (chatsDB.length > 0) {
      const preferredChat = chatsDB.find((chat) => chat.id === preSelectedId);
      setSelectedChat(preferredChat?.id ?? chatsDB[0].id);
    } else {
      setSelectedChat(undefined);
    }
    setChats(chatsDB);
  }, []);

  const handleImportComplete = useCallback(
    (chatIds: number[]) => {
      void fetchChatCount(chatIds.at(-1) ?? null);
    },
    [fetchChatCount],
  );

  useEffect(() => {
    if (!selectedChat || !selectedYear) {
      setMessages([]);
      setPersons([]);
      return;
    }

    let cancelled = false;
    setMessages([]);
    setPersons([]);
    localStorage.setItem(selectedYearKey(selectedChat), String(selectedYear));

    fetchMessages(selectedChat, selectedYear).then(({ messages, persons }) => {
      if (cancelled) return;
      setMessages(messages);
      setPersons(persons);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchMessages, selectedChat, selectedYear]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      setPersons([]);
      setAvailableYears([]);
      setSelectedYear(null);
      return;
    }

    let cancelled = false;
    setMessages([]);
    setPersons([]);
    setAvailableYears([]);
    setSelectedYear(null);
    localStorage.setItem("wa_selectedChat", String(selectedChat));

    const storedYear =
      localStorage.getItem(selectedYearKey(selectedChat)) ??
      localStorage.getItem("wa_selectedYear");
    fetchYears(selectedChat, storedYear ? Number(storedYear) : null).then(
      ({ selected, years }) => {
        if (cancelled) return;
        setAvailableYears(years);
        setSelectedYear(selected);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [fetchYears, selectedChat]);

  useEffect(() => {
    const showN = localStorage.getItem("showNames");
    const storedChat = localStorage.getItem("wa_selectedChat");
    setShowNames(showN === "true");
    if (storedChat) {
      fetchChatCount(Number(storedChat));
    } else {
      fetchChatCount();
    }
  }, [fetchChatCount, setShowNames]);

  const personsDynamic = showNames
    ? persons
    : persons.map((person, index) => ({
        ...person,
        name: `Person ${index + 1}`,
      }));
  const selectedChatName =
    chats.find((chat) => chat.id === selectedChat)?.name ?? "Selected chat";
  const firstMessageDate = message[0] ? dateFromMessage(message[0]) : null;
  const lastMessageDate = message.at(-1)
    ? dateFromMessage(message.at(-1)!)
    : null;
  const dateRange =
    firstMessageDate && lastMessageDate
      ? `${firstMessageDate.toLocaleDateString()} - ${lastMessageDate.toLocaleDateString()}`
      : "No messages loaded";
  const contextStats = [
    { label: "Chat", value: selectedChatName },
    { label: "Year", value: selectedYear?.toString() ?? "n/a" },
    { label: "Messages", value: message.length.toLocaleString() },
    { label: "Participants", value: personsDynamic.length.toString() },
    { label: "Date span", value: dateRange },
    { label: "Names", value: showNames ? "Visible" : "Hidden" },
  ];

  if (chats.length === 0) {
    return (
      <>
        <HandlewhatsappData onImportComplete={handleImportComplete} />
      </>
    );
  }

  return (
    <>
      <HandlewhatsappData compact onImportComplete={handleImportComplete} />
      <div className="mt-5 flex flex-col gap-3 border-b border-border/80 pb-4 sm:mb-7 lg:flex-row lg:items-end lg:justify-between dark:border-neutral-800">
        <div className="grid gap-3 sm:grid-cols-[minmax(16rem,24rem)_8rem]">
          <label className="space-y-1">
            <span className="tool-label text-xs">Chat</span>
            <select
              value={selectedChat ?? ""}
              onChange={(e) => setSelectedChat(+e.target.value)}
              className="tool-field h-9 w-full py-0"
            >
              {chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="tool-label text-xs">Year</span>
            <select
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="tool-field h-9 w-full py-0"
              disabled={availableYears.length === 0}
            >
              {availableYears.length === 0 && (
                <option value="">No years</option>
              )}
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("showNames", String(!showNames));
              setShowNames(!showNames);
            }}
            className="tool-button-secondary min-h-9 px-3"
          >
            {showNames ? "Hide Names" : "Show Names"}
          </button>
          <button
            type="button"
            onClick={clearSavedData}
            className="tool-button-danger min-h-9 px-3"
          >
            Clear Data
          </button>
        </div>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-3 border-b border-border/70 pb-4 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 dark:border-neutral-800">
        {contextStats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="mt-1 truncate font-medium text-foreground">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        {personsDynamic.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Participants</h2>
            <ul className="list-disc pl-5">
              {personsDynamic.map((person) => (
                <li key={person.id} className="text-sm">
                  {person.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <MessageGraphs messages={message} persons={personsDynamic} />
    </>
  );
}
