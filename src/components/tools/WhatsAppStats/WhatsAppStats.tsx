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
  isDataUploadedAtom,
  showNamesAtom,
  uploadedChatIdAtom,
  whatsappDB,
  type Chat,
  type Message,
  type Person,
} from "./db";
import { HandlewhatsappData } from "./Upload";
import { compareMessagesByTimestamp } from "./datetime";

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
  const [isDataUploaded, setIsDataUploaded] = useAtom(isDataUploadedAtom);
  const [uploadedChatId, setUploadedChatId] = useAtom(uploadedChatIdAtom);
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
    setUploadedChatId(null);
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

  useEffect(() => {
    if (isDataUploaded) {
      fetchChatCount(uploadedChatId);
      setIsDataUploaded(false);
      setUploadedChatId(null);
    }
  }, [
    fetchChatCount,
    isDataUploaded,
    setIsDataUploaded,
    setUploadedChatId,
    uploadedChatId,
  ]);

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

  if (chats.length === 0) {
    return (
      <>
        <HandlewhatsappData />
      </>
    );
  }

  return (
    <>
      <HandlewhatsappData />
      <div className="mt-4 flex flex-wrap items-center justify-start gap-x-2 gap-y-2 sm:mb-8">
        <select
          value={selectedChat ?? ""}
          onChange={(e) => setSelectedChat(+e.target.value)}
          className="max-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          {chats.map((chat) => (
            <option key={chat.id} value={chat.id}>
              {chat.name}
            </option>
          ))}
        </select>
        <select
          value={selectedYear ?? ""}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          disabled={availableYears.length === 0}
        >
          {availableYears.length === 0 && <option value="">No years</option>}
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem("showNames", String(!showNames));
            setShowNames(!showNames);
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          {showNames ? "Hide Names" : "Show Names"}
        </button>
        <button
          type="button"
          onClick={clearSavedData}
          className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90"
        >
          Clear Data
        </button>
      </div>
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
