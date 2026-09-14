import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAtom } from "jotai";
import {
  Download,
  FileArchive,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";
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
import {
  buildDashboardSummary,
  createStableAliases,
  filterMessagesByDateRange,
  formatDuration,
} from "./dashboardMetrics";
import MessageGraphs from "./MessageGraphs";

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

type Period = number | "all";
type Confirmation =
  | { kind: "delete-all" }
  | { kind: "delete-chat"; chatId: number }
  | { kind: "backup" }
  | null;

const selectedPeriodKey = (chatId: number) => `wa_selectedPeriod:${chatId}`;

const downloadBlob = (contents: BlobPart, fileName: string, type: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const safeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "chat";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );

function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-confirm-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <h2 id="wa-confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="tool-button-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            className={danger ? "tool-button-danger" : "tool-button"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WhatsappStats() {
  const [, setIsCleared] = useAtom(isClearedAtom);
  const [showNames, setShowNames] = useAtom(showNamesAtom);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [selectedChat, setSelectedChat] = useState<number>();
  const [chats, setChats] = useState<Chat[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [previousMessages, setPreviousMessages] = useState<Message[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [renaming, setRenaming] = useState(false);
  const [nextChatName, setNextChatName] = useState("");

  const fetchChats = useCallback(async (preferredId?: number | null) => {
    setLoadingChats(true);
    setDatabaseError(null);
    try {
      const chatRows = await whatsappDB.chats.toArray();
      setChats(chatRows);
      if (chatRows.length) {
        const preferred = chatRows.find((chat) => chat.id === preferredId);
        setSelectedChat(preferred?.id ?? chatRows[0].id);
      } else {
        setSelectedChat(undefined);
      }
    } catch (caught) {
      setDatabaseError(
        caught instanceof Error
          ? caught.message
          : "Local chat storage could not be opened.",
      );
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const fetchYears = useCallback(async (chatId: number) => {
    const pairs = await whatsappDB.messages
      .where("[chatId+year]")
      .between([chatId, 2009], [chatId, new Date().getFullYear() + 1])
      .uniqueKeys();
    return Array.from(
      new Set(
        pairs.map((pair) =>
          Array.isArray(pair) ? Number(pair[1]) : Number(pair),
        ),
      ),
    )
      .filter((year) => !Number.isNaN(year))
      .sort((a, b) => a - b);
  }, []);

  const fetchDashboardData = useCallback(
    async (chatId: number, period: Period) => {
      const [messageRows, personRows, previousRows] = await Promise.all([
        period === "all"
          ? whatsappDB.messages.where("chatId").equals(chatId).toArray()
          : whatsappDB.messages.where({ chatId, year: period }).toArray(),
        whatsappDB.persons.where("chatId").equals(chatId).toArray(),
        period === "all"
          ? Promise.resolve([] as Message[])
          : whatsappDB.messages.where({ chatId, year: period - 1 }).toArray(),
      ]);
      const sorted = [...messageRows].sort(compareMessagesByTimestamp);
      return {
        messages: sorted,
        previousMessages: [...previousRows].sort(compareMessagesByTimestamp),
        persons: personRows,
      };
    },
    [],
  );

  const handleImportComplete = useCallback(
    (chatIds: number[]) => void fetchChats(chatIds.at(-1) ?? null),
    [fetchChats],
  );

  useEffect(() => {
    const storedChat = localStorage.getItem("wa_selectedChat");
    setShowNames(localStorage.getItem("showNames") === "true");
    void fetchChats(storedChat ? Number(storedChat) : null);
  }, [fetchChats, setShowNames]);

  useEffect(() => {
    if (!selectedChat) {
      setAvailableYears([]);
      setSelectedPeriod(null);
      setMessages([]);
      setPreviousMessages([]);
      setPersons([]);
      return;
    }

    let cancelled = false;
    setDatabaseError(null);
    localStorage.setItem("wa_selectedChat", String(selectedChat));
    fetchYears(selectedChat)
      .then((years) => {
        if (cancelled) return;
        setAvailableYears(years);
        const stored = localStorage.getItem(selectedPeriodKey(selectedChat));
        const storedPeriod: Period | null =
          stored === "all" ? "all" : stored ? Number(stored) : null;
        setSelectedPeriod(
          storedPeriod === "all" ||
            (typeof storedPeriod === "number" && years.includes(storedPeriod))
            ? storedPeriod
            : (years.at(-1) ?? "all"),
        );
      })
      .catch((caught) => {
        if (!cancelled) {
          setDatabaseError(
            caught instanceof Error
              ? caught.message
              : "Years could not be loaded.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchYears, selectedChat]);

  useEffect(() => {
    if (!selectedChat || selectedPeriod === null) return;
    let cancelled = false;
    setLoadingData(true);
    setDatabaseError(null);
    localStorage.setItem(
      selectedPeriodKey(selectedChat),
      String(selectedPeriod),
    );
    fetchDashboardData(selectedChat, selectedPeriod)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setPreviousMessages(data.previousMessages);
        setPersons(data.persons);
      })
      .catch((caught) => {
        if (!cancelled) {
          setDatabaseError(
            caught instanceof Error
              ? caught.message
              : "Chat data could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDashboardData, selectedChat, selectedPeriod]);

  const aliases = useMemo(() => createStableAliases(persons), [persons]);
  const displayPersons = useMemo(
    () =>
      persons.map((person) => ({
        ...person,
        name: showNames
          ? person.name
          : (aliases.get(person.id) ?? "Participant"),
      })),
    [aliases, persons, showNames],
  );
  const invalidDateRange = Boolean(
    customStart && customEnd && customStart > customEnd,
  );
  const filteredMessages = useMemo(
    () =>
      filterMessagesByDateRange(
        messages,
        !invalidDateRange && (customStart || customEnd)
          ? { start: customStart, end: customEnd }
          : null,
      ),
    [customEnd, customStart, invalidDateRange, messages],
  );
  const activePersonIds = useMemo(
    () => new Set(filteredMessages.map((message) => message.personId)),
    [filteredMessages],
  );
  const filteredPersons = displayPersons.filter((person) =>
    activePersonIds.has(person.id),
  );
  const summary = useMemo(
    () => buildDashboardSummary(filteredMessages, filteredPersons),
    [filteredMessages, filteredPersons],
  );
  const previousSummary = useMemo(
    () =>
      selectedPeriod !== "all" &&
      !customStart &&
      !customEnd &&
      previousMessages.length
        ? buildDashboardSummary(previousMessages, persons)
        : null,
    [customEnd, customStart, persons, previousMessages, selectedPeriod],
  );
  const selectedChatRow = chats.find((chat) => chat.id === selectedChat);
  const selectedChatName = selectedChatRow?.name ?? "Selected chat";
  const firstMessageDate = filteredMessages[0]
    ? dateFromMessage(filteredMessages[0])
    : null;
  const lastMessageDate = filteredMessages.at(-1)
    ? dateFromMessage(filteredMessages.at(-1)!)
    : null;

  const clearAll = async () => {
    await whatsappDB.transaction(
      "rw",
      whatsappDB.chats,
      whatsappDB.persons,
      whatsappDB.messages,
      async () => {
        await whatsappDB.messages.clear();
        await whatsappDB.persons.clear();
        await whatsappDB.chats.clear();
      },
    );
    Object.keys(localStorage)
      .filter((key) => key.startsWith("wa_"))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem("showNames");
    setChats([]);
    setSelectedChat(undefined);
    setMessages([]);
    setPreviousMessages([]);
    setPersons([]);
    setShowNames(false);
    setIsCleared(true);
    setConfirmation(null);
  };

  const deleteChat = async (chatId: number) => {
    await whatsappDB.transaction(
      "rw",
      whatsappDB.chats,
      whatsappDB.persons,
      whatsappDB.messages,
      async () => {
        await whatsappDB.messages.where("chatId").equals(chatId).delete();
        await whatsappDB.persons.where("chatId").equals(chatId).delete();
        await whatsappDB.chats.delete(chatId);
      },
    );
    localStorage.removeItem(selectedPeriodKey(chatId));
    setConfirmation(null);
    await fetchChats();
  };

  const renameChat = async () => {
    const name = nextChatName.trim();
    if (!selectedChat || !name) return;
    await whatsappDB.chats.update(selectedChat, { name });
    setChats((current) =>
      current.map((chat) =>
        chat.id === selectedChat ? { ...chat, name } : chat,
      ),
    );
    setRenaming(false);
  };

  const restoreBackup = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text()) as {
        format?: string;
        chat?: Chat;
        persons?: Person[];
        messages?: Message[];
      };
      if (
        payload.format !== "mauroner-whatsapp-stats-backup" ||
        !payload.chat ||
        !Array.isArray(payload.persons) ||
        !Array.isArray(payload.messages)
      ) {
        throw new Error("This is not a supported WhatsApp Stats backup.");
      }

      const restoredId = await whatsappDB.transaction(
        "rw",
        whatsappDB.chats,
        whatsappDB.persons,
        whatsappDB.messages,
        async () => {
          if (
            payload.chat?.fingerprint &&
            (await whatsappDB.chats
              .where("fingerprint")
              .equals(payload.chat.fingerprint)
              .first())
          ) {
            throw new Error("This chat is already stored in this browser.");
          }
          const chatId = await whatsappDB.chats.add({
            name: `${payload.chat!.name} (restored)`,
            fingerprint: payload.chat!.fingerprint,
            importedAt: new Date().toISOString(),
            messageCount: payload.messages!.length,
            firstDate: payload.chat!.firstDate,
            lastDate: payload.chat!.lastDate,
          });
          const personIds = new Map<number, number>();
          for (const person of payload.persons!) {
            const personId = await whatsappDB.persons.add({
              chatId,
              name: String(person.name),
            });
            personIds.set(person.id, personId);
          }
          await whatsappDB.messages.bulkAdd(
            payload.messages!.map((message) => ({
              chatId,
              personId: personIds.get(message.personId)!,
              date: String(message.date),
              time: String(message.time),
              year: Number(message.year),
              text: String(message.text),
            })),
          );
          return chatId;
        },
      );
      setDatabaseError(null);
      await fetchChats(restoredId);
    } catch (caught) {
      setDatabaseError(
        caught instanceof Error
          ? caught.message
          : "The backup could not be restored.",
      );
    }
  };

  const downloadSummary = () => {
    const reportName = showNames ? selectedChatName : "WhatsApp chat";
    const title = escapeHtml(`${reportName} summary`);
    const metrics = [
      ["Messages", summary.messages.toLocaleString()],
      ["Messages / active day", summary.messagesPerActiveDay.toFixed(1)],
      [
        "Busiest hour",
        summary.busiestHour ? `${summary.busiestHour.hour}:00` : "n/a",
      ],
      ["Median response", formatDuration(summary.medianResponseMinutes)],
      ["Media share", `${(summary.mediaShare * 100).toFixed(1)}%`],
      ["Longest active streak", `${summary.longestActiveStreak} days`],
    ];
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{font:16px system-ui;max-width:760px;margin:4rem auto;padding:0 1.25rem;color:#18231c}h1{font-size:2rem}.note{color:#526057}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:2rem 0}.card{border:1px solid #cad5cd;border-radius:12px;padding:16px}.label{font-size:12px;text-transform:uppercase;color:#66736a}.value{font-size:22px;font-weight:700;margin-top:6px}</style><h1>${title}</h1><p class="note">Aggregate report generated locally on ${new Date().toLocaleDateString()}. Participant names and message contents are not included.</p><div class="grid">${metrics.map(([label, value]) => `<div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("")}</div></html>`;
    downloadBlob(html, `${safeFileName(reportName)}-summary.html`, "text/html");
  };

  const downloadBackup = async () => {
    if (!selectedChat || !selectedChatRow) return;
    const [allMessages, allPersons] = await Promise.all([
      whatsappDB.messages.where("chatId").equals(selectedChat).toArray(),
      whatsappDB.persons.where("chatId").equals(selectedChat).toArray(),
    ]);
    downloadBlob(
      JSON.stringify(
        {
          format: "mauroner-whatsapp-stats-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          chat: selectedChatRow,
          persons: allPersons,
          messages: allMessages,
        },
        null,
        2,
      ),
      `${safeFileName(selectedChatName)}-backup.json`,
      "application/json",
    );
    setConfirmation(null);
  };

  if (loadingChats) {
    return (
      <div
        className="tool-panel flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Opening local chats…
      </div>
    );
  }

  if (databaseError && chats.length === 0) {
    return (
      <div className="tool-panel" role="alert">
        <h2 className="font-semibold">Local data could not be opened</h2>
        <p className="mt-2 text-sm text-muted-foreground">{databaseError}</p>
        <button
          type="button"
          className="tool-button mt-4"
          onClick={() => void fetchChats()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (chats.length === 0) {
    return <HandlewhatsappData onImportComplete={handleImportComplete} />;
  }

  const percentChange = (current: number, previous?: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs ${
      typeof selectedPeriod === "number" ? selectedPeriod - 1 : "previous"
    }`;
  };
  const summaryCards = [
    {
      label: "Messages",
      value: summary.messages.toLocaleString(),
      change: percentChange(summary.messages, previousSummary?.messages),
    },
    {
      label: "Per active day",
      value: summary.messagesPerActiveDay.toFixed(1),
      change: percentChange(
        summary.messagesPerActiveDay,
        previousSummary?.messagesPerActiveDay,
      ),
    },
    {
      label: "Busiest hour",
      value: summary.busiestHour
        ? `${String(summary.busiestHour.hour).padStart(2, "0")}:00 · ${summary.busiestHour.count}`
        : "n/a",
      change: null,
    },
    {
      label: "Most active",
      value: summary.mostActivePerson?.name ?? "n/a",
      change: null,
    },
    {
      label: "Median response",
      value: formatDuration(summary.medianResponseMinutes),
      change: null,
    },
    {
      label: "Media share",
      value: `${(summary.mediaShare * 100).toFixed(1)}%`,
      change: previousSummary
        ? `${((summary.mediaShare - previousSummary.mediaShare) * 100).toFixed(1)}pp vs ${typeof selectedPeriod === "number" ? selectedPeriod - 1 : "previous"}`
        : null,
    },
    {
      label: "Longest streak",
      value: `${summary.longestActiveStreak} days`,
      change: null,
    },
  ];

  return (
    <>
      <HandlewhatsappData compact onImportComplete={handleImportComplete} />
      <section className="mt-5 rounded-xl border border-border/80 bg-card/60 p-4 dark:border-neutral-800">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_9rem_minmax(18rem,auto)] lg:items-end">
          <label className="space-y-1">
            <span className="tool-label text-xs">Chat</span>
            <select
              value={selectedChat ?? ""}
              onChange={(event) => setSelectedChat(Number(event.target.value))}
              className="tool-field h-10 w-full py-0"
            >
              {chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="tool-label text-xs">Period</span>
            <select
              value={selectedPeriod ?? ""}
              onChange={(event) =>
                setSelectedPeriod(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
                )
              }
              className="tool-field h-10 w-full py-0"
            >
              <option value="all">All time</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              aria-pressed={!showNames}
              onClick={() => {
                localStorage.setItem("showNames", String(!showNames));
                setShowNames(!showNames);
              }}
              className="tool-button-secondary min-h-10"
            >
              {showNames ? "Anonymize display" : "Show real names"}
            </button>
            <button
              type="button"
              className="tool-button-secondary min-h-10"
              onClick={downloadSummary}
            >
              <Download aria-hidden="true" className="h-4 w-4" /> Summary
            </button>
            <details className="relative">
              <summary className="tool-button-secondary flex min-h-10 cursor-pointer list-none items-center">
                Manage
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-64 space-y-2 rounded-lg border bg-card p-3 shadow-xl">
                {renaming ? (
                  <div className="space-y-2">
                    <label
                      className="tool-label text-xs"
                      htmlFor="wa-chat-name"
                    >
                      Chat name
                    </label>
                    <input
                      id="wa-chat-name"
                      className="tool-field"
                      value={nextChatName}
                      onChange={(event) => setNextChatName(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="tool-button"
                        onClick={() => void renameChat()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="tool-button-secondary"
                        onClick={() => setRenaming(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="tool-button-secondary w-full justify-start"
                      onClick={() => {
                        setNextChatName(selectedChatName);
                        setRenaming(true);
                      }}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" /> Rename
                      chat
                    </button>
                    <button
                      type="button"
                      className="tool-button-secondary w-full justify-start"
                      onClick={() => setConfirmation({ kind: "backup" })}
                    >
                      <FileArchive aria-hidden="true" className="h-4 w-4" />{" "}
                      Backup raw chat
                    </button>
                    <input
                      id="wa-restore-backup"
                      type="file"
                      accept="application/json,.json"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void restoreBackup(file);
                      }}
                    />
                    <label
                      htmlFor="wa-restore-backup"
                      className="tool-button-secondary flex w-full cursor-pointer justify-start"
                    >
                      <FileArchive aria-hidden="true" className="h-4 w-4" />{" "}
                      Restore backup
                    </label>
                    <button
                      type="button"
                      className="tool-button-danger w-full justify-start"
                      onClick={() =>
                        selectedChat &&
                        setConfirmation({
                          kind: "delete-chat",
                          chatId: selectedChat,
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete
                      this chat
                    </button>
                    <button
                      type="button"
                      className="tool-button-danger w-full justify-start"
                      onClick={() => setConfirmation({ kind: "delete-all" })}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete
                      all chats
                    </button>
                  </>
                )}
              </div>
            </details>
          </div>
        </div>

        <details className="mt-4 border-t border-border/70 pt-3">
          <summary className="cursor-pointer text-sm font-medium">
            Custom date range
          </summary>
          <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="tool-label text-xs">From</span>
              <input
                type="date"
                className="tool-field"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="tool-label text-xs">To</span>
              <input
                type="date"
                className="tool-field"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </label>
          </div>
          {(customStart || customEnd) && (
            <button
              type="button"
              className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setCustomStart("");
                setCustomEnd("");
              }}
            >
              Clear date range
            </button>
          )}
          {invalidDateRange && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              The start date must be before the end date.
            </p>
          )}
        </details>
      </section>

      {databaseError && (
        <p
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {databaseError}
        </p>
      )}

      {loadingData ? (
        <div
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          role="status"
          aria-label="Loading dashboard"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (
        <>
          <section aria-labelledby="wa-highlights" className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="wa-highlights" className="text-lg font-semibold">
                  Highlights
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {firstMessageDate && lastMessageDate
                    ? `${firstMessageDate.toLocaleDateString()} – ${lastMessageDate.toLocaleDateString()}`
                    : "No messages in this range"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Names are {showNames ? "visible" : "anonymized on screen"}.
              </p>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-border/80 bg-card p-3"
                >
                  <dt className="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </dt>
                  <dd className="mt-2 truncate text-lg font-semibold">
                    {card.value}
                  </dd>
                  {card.change && (
                    <dd className="mt-1 text-[0.68rem] text-muted-foreground">
                      {card.change}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </section>
          <MessageGraphs
            messages={filteredMessages}
            persons={filteredPersons}
          />
        </>
      )}

      {confirmation?.kind === "delete-chat" && (
        <ConfirmationDialog
          title={`Delete “${selectedChatName}”?`}
          description="This permanently removes this chat, its participants, and all of its messages from this browser. Other imported chats are kept."
          confirmLabel="Delete chat"
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void deleteChat(confirmation.chatId)}
        />
      )}
      {confirmation?.kind === "delete-all" && (
        <ConfirmationDialog
          title="Delete every local chat?"
          description={`This permanently removes all ${chats.length} imported chat${chats.length === 1 ? "" : "s"} and their messages from this browser.`}
          confirmLabel="Delete all chats"
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void clearAll()}
        />
      )}
      {confirmation?.kind === "backup" && (
        <ConfirmationDialog
          title="Download a raw local backup?"
          description="Unlike the anonymized summary, this JSON backup contains participant names and full message text. Keep it private."
          confirmLabel="Download backup"
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void downloadBackup()}
        />
      )}
    </>
  );
}
