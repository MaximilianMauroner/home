import { useState, useEffect } from "react";
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
  whatsappDB,
  type Chat,
  type Message,
  type Person,
} from "./db";
import { HandlewhatsappData } from "./Upload";

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

import { atom, useAtom } from "jotai";
import MessageGraphs from "./MessageGraphs";

export default function WhatsappStats() {
  // Add new state for showing/hiding names

  const [_, setIsCleared] = useAtom(isClearedAtom);
  const [isDataUploaded, setIsDataUploaded] = useAtom(isDataUploadedAtom);
  const [showNames, setShowNames] = useAtom(showNamesAtom);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedChat, setSelectedChat] = useState<number>();
  const [chats, setChats] = useState<Chat[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [message, setMessages] = useState<Message[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);

  function clearSavedData() {
    whatsappDB.chats.clear();
    whatsappDB.persons.clear();
    setChats([]);
    setSelectedChat(undefined);
    setIsCleared(true);
    setMessages([]);
    setPersons([]);
    setAvailableYears([]);
    setSelectedYear(null);
  }

  const fetchYears = async (preselectedYear?: number) => {
    if (!selectedChat) return;
    const currentYear = new Date().getFullYear() + 1;
    const pairs = await whatsappDB.messages
      .where("[chatId+year]")
      .between([selectedChat, 2009], [selectedChat, currentYear])
      .uniqueKeys();

    // Extract unique years from the pairs
    // pairs is likely an array of arrays or values, so extract years accordingly
    const years = Array.from(
      new Set(pairs.map((pair) => (Array.isArray(pair) ? pair[1] : pair))),
    ).sort();
    setAvailableYears(years as number[]);
    if (preselectedYear) {
      const y = years.find((year) => year === preselectedYear);
      if (y) {
        setSelectedYear(y as number);
        return;
      }
    }
    setSelectedYear(years[years.length - 1] as number);
  };

  const fetchMessages = async () => {
    if (!selectedChat || !selectedYear) return;
    const messagesDB = await whatsappDB.messages
      .where({ chatId: selectedChat, year: selectedYear })
      .toArray();

    const persons = await whatsappDB.persons
      .where("chatId")
      .equals(selectedChat)
      .toArray();

    setMessages(messagesDB);
    setPersons(persons);
  };

  // Refactor fetchChatCount so it can be called after upload
  const fetchChatCount = async (preSelectedId?: number) => {
    const chatsDB = await whatsappDB.chats.toArray();
    if (chatsDB.length > 0) {
      if (preSelectedId === null) {
        setSelectedChat(chatsDB[0].id);
      } else {
        const chat = chatsDB.find((chat) => chat.id === preSelectedId);
        if (chat) {
          setSelectedChat(chat.id);
        } else {
          setSelectedChat(chatsDB[0].id);
        }
      }
    }
    setChats(chatsDB);
  };

  useEffect(() => {
    if (isDataUploaded) {
      fetchChatCount();
      setIsDataUploaded(false);
    }
  }, [isDataUploaded]);

  useEffect(() => {
    if (selectedYear) {
      fetchMessages();
      // Save selected year to localStorage
      localStorage.setItem("wa_selectedYear", String(selectedYear));
    }
  }, [selectedYear, availableYears]);

  useEffect(() => {
    if (selectedChat) {
      const storedChat = localStorage.getItem("wa_selectedChat");
      const storedYear = localStorage.getItem("wa_selectedYear");
      if (storedChat && storedYear) {
        fetchYears(Number(storedYear));
      } else {
        fetchYears();
      }
      // Save selected chat to localStorage
      localStorage.setItem("wa_selectedChat", String(selectedChat));
    }
  }, [selectedChat]);

  useEffect(() => {
    const showN = localStorage.getItem("showNames");
    const storedChat = localStorage.getItem("wa_selectedChat");
    const storedYear = localStorage.getItem("wa_selectedYear");
    setShowNames(showN === "true");
    if (storedChat && storedYear) {
      fetchChatCount(Number(storedChat));
    } else {
      fetchChatCount();
    }
  }, []);

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
          value={selectedChat}
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
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            localStorage.setItem("showNames", String(!showNames));
            setShowNames(!showNames);
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          {showNames ? "Hide Names" : "Show Names"}
        </button>
        <button
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
