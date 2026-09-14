import JSZip from "jszip";
import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { isClearedAtom, whatsappDB, type Chat } from "./db";
import { runParser } from "./runParser";
import type { ParsedChat } from "./parsing";

type ImportStage = "extracting" | "reading" | "parsing" | "saving";

interface ImportProgress {
  stage: ImportStage;
  fileName: string;
  fileIndex: number;
  totalFiles: number;
  parsedMessages: number;
  processedLines: number;
  totalLines: number;
}

interface PreparedChat {
  fileName: string;
  parsedChat: ParsedChat;
  fingerprint: string;
  firstDate: string;
  lastDate: string;
  duplicate: Chat | null;
}

interface ImportResult {
  fileName: string;
  status: "imported" | "duplicate" | "error";
  detail: string;
}

interface HandleWhatsappDataProps {
  onImportComplete: (chatIds: number[]) => void;
  compact?: boolean;
}

const digestText = async (text: string): Promise<string> => {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv-${(hash >>> 0).toString(16)}`;
};

const chatDateRange = (chat: ParsedChat) => {
  const dates = chat.messages
    .map((message) => {
      const [day, month, year] = message.date.split("/");
      return `${year}-${month}-${day}`;
    })
    .sort();
  return { firstDate: dates[0] ?? "", lastDate: dates.at(-1) ?? "" };
};

export function HandlewhatsappData({
  onImportComplete,
  compact = false,
}: HandleWhatsappDataProps) {
  const [isCleared, setIsCleared] = useAtom(isClearedAtom);
  const [prepared, setPrepared] = useState<PreparedChat[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const resetSelection = () => {
    setPrepared([]);
    setResults([]);
    setError(null);
    setProgress(null);
  };

  const readText = async (
    file: File,
    fileIndex: number,
    totalFiles: number,
  ) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setProgress({
        stage: "reading",
        fileName: file.name,
        fileIndex,
        totalFiles,
        parsedMessages: 0,
        processedLines: 0,
        totalLines: 0,
      });
      return file.text();
    }

    setProgress({
      stage: "extracting",
      fileName: file.name,
      fileIndex,
      totalFiles,
      parsedMessages: 0,
      processedLines: 0,
      totalLines: 0,
    });
    const zip = await JSZip.loadAsync(file);
    const textFile = Object.values(zip.files).find(
      (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".txt"),
    );
    if (!textFile)
      throw new Error("The ZIP does not contain a chat text file.");
    return textFile.async("text");
  };

  const prepareFiles = async (files: File[]) => {
    const validFiles = files.filter((file) => /\.(txt|zip)$/i.test(file.name));
    if (validFiles.length === 0) {
      setError("Choose a WhatsApp .txt export or a .zip containing one.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    const nextPrepared: PreparedChat[] = [];
    const nextResults: ImportResult[] = [];
    const batchFingerprints = new Set<string>();

    for (const [index, file] of validFiles.entries()) {
      try {
        const text = await readText(file, index + 1, validFiles.length);
        setProgress({
          stage: "parsing",
          fileName: file.name,
          fileIndex: index + 1,
          totalFiles: validFiles.length,
          parsedMessages: 0,
          processedLines: 0,
          totalLines: 0,
        });
        const parsedChat = await runParser(text, (parseProgress) => {
          setProgress((current) =>
            current
              ? {
                  ...current,
                  parsedMessages: parseProgress.parsedMessages,
                  processedLines: parseProgress.processedLines,
                  totalLines: parseProgress.totalLines,
                }
              : current,
          );
        });
        if (!parsedChat.messages.length || !parsedChat.participants.length) {
          throw new Error("No supported WhatsApp messages were detected.");
        }

        const fingerprint = await digestText(text);
        const duplicate = batchFingerprints.has(fingerprint)
          ? ({ id: -1, name: "another selected file" } as Chat)
          : ((await whatsappDB.chats
              .where("fingerprint")
              .equals(fingerprint)
              .first()) ?? null);
        batchFingerprints.add(fingerprint);
        nextPrepared.push({
          fileName: file.name,
          parsedChat,
          fingerprint,
          duplicate,
          ...chatDateRange(parsedChat),
        });
      } catch (caught) {
        nextResults.push({
          fileName: file.name,
          status: "error",
          detail:
            caught instanceof Error
              ? caught.message
              : "The file could not be read.",
        });
      }
    }

    setPrepared(nextPrepared);
    setResults(nextResults);
    setProgress(null);
    setLoading(false);
  };

  const savePreparedChat = async (candidate: PreparedChat): Promise<number> =>
    whatsappDB.transaction(
      "rw",
      whatsappDB.chats,
      whatsappDB.persons,
      whatsappDB.messages,
      async () => {
        const chatId = await whatsappDB.chats.add({
          name: candidate.fileName.replace(/\.(txt|zip)$/i, ""),
          fingerprint: candidate.fingerprint,
          importedAt: new Date().toISOString(),
          messageCount: candidate.parsedChat.messages.length,
          firstDate: candidate.firstDate,
          lastDate: candidate.lastDate,
        });
        await whatsappDB.persons.bulkAdd(
          candidate.parsedChat.participants.map((name) => ({ name, chatId })),
        );
        const persons = await whatsappDB.persons.where({ chatId }).toArray();
        const personIdByName = new Map(
          persons.map((person) => [person.name, person.id]),
        );
        await whatsappDB.messages.bulkAdd(
          candidate.parsedChat.messages.map((message) => ({
            personId: personIdByName.get(message.user)!,
            chatId,
            time: message.time,
            date: message.date,
            text: message.text,
            year: message.year,
          })),
        );
        return chatId;
      },
    );

  const importPrepared = async () => {
    setLoading(true);
    setError(null);
    const importedIds: number[] = [];
    const nextResults = [...results];

    for (const [index, candidate] of prepared.entries()) {
      if (candidate.duplicate) {
        nextResults.push({
          fileName: candidate.fileName,
          status: "duplicate",
          detail: `Already imported as “${candidate.duplicate.name}”.`,
        });
        continue;
      }

      setProgress({
        stage: "saving",
        fileName: candidate.fileName,
        fileIndex: index + 1,
        totalFiles: prepared.length,
        parsedMessages: candidate.parsedChat.messages.length,
        processedLines: 0,
        totalLines: 0,
      });
      try {
        const chatId = await savePreparedChat(candidate);
        importedIds.push(chatId);
        nextResults.push({
          fileName: candidate.fileName,
          status: "imported",
          detail: `${candidate.parsedChat.messages.length.toLocaleString()} messages saved locally.`,
        });
      } catch (caught) {
        nextResults.push({
          fileName: candidate.fileName,
          status: "error",
          detail:
            caught instanceof Error
              ? caught.message
              : "The chat could not be saved.",
        });
      }
    }

    setResults(nextResults);
    setPrepared([]);
    setProgress(null);
    setLoading(false);
    if (importedIds.length) onImportComplete(importedIds);
  };

  useEffect(() => {
    if (!isCleared) return;
    resetSelection();
    setIsCleared(false);
  }, [isCleared, setIsCleared]);

  const progressPercent = progress?.totalLines
    ? Math.round((progress.processedLines / progress.totalLines) * 100)
    : 20;
  const progressText = progress
    ? `${
        progress.stage === "saving"
          ? "Saving"
          : progress.stage === "parsing"
            ? "Checking"
            : progress.stage === "extracting"
              ? "Extracting"
              : "Reading"
      } ${progress.fileName} (${progress.fileIndex}/${progress.totalFiles})`
    : "Preparing files";
  const uploadInputId = compact
    ? "whatsapp-chat-export-compact"
    : "whatsapp-chat-export";
  const uploadHelpId = `${uploadInputId}-help`;

  const uploadContent = (
    <div
      className="tool-upload-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void prepareFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        id={uploadInputId}
        type="file"
        accept=".txt,.zip"
        multiple
        disabled={loading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void prepareFiles(files);
        }}
        className="sr-only"
        aria-describedby={uploadHelpId}
      />
      <label htmlFor={uploadInputId} className="tool-button cursor-pointer">
        {prepared.length ? "Choose different files" : "Choose files"}
      </label>
      <p
        id={uploadHelpId}
        className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground"
      >
        Choose a WhatsApp chat `.txt` export or a `.zip` containing it. Nothing
        leaves this browser.
      </p>

      {!compact && (
        <details className="mx-auto mt-5 max-w-3xl border-t border-border pt-4 text-left text-sm">
          <summary className="cursor-pointer font-semibold text-foreground">
            How to export a chat
          </summary>
          <div className="mt-3 grid gap-4 leading-6 text-muted-foreground sm:grid-cols-2">
            <div>
              <h2 className="font-medium text-foreground">iPhone</h2>
              <p>Open the chat, tap its name, then Export Chat.</p>
            </div>
            <div>
              <h2 className="font-medium text-foreground">Android</h2>
              <p>Open the chat, choose More → Export chat.</p>
            </div>
            <p className="sm:col-span-2">
              Choose <strong className="text-foreground">Without Media</strong>{" "}
              for the fastest import and the smallest privacy footprint.
            </p>
          </div>
        </details>
      )}

      {loading && (
        <div className="mt-4" aria-live="polite">
          <div
            role="progressbar"
            aria-label="Import progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(5, progressPercent)}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{progressText}</p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {prepared.length > 0 && (
        <div className="mx-auto mt-5 max-w-3xl text-left">
          <h2 className="text-sm font-semibold">Ready to import</h2>
          <ul className="mt-2 divide-y rounded-lg border text-sm">
            {prepared.map((candidate) => (
              <li
                key={`${candidate.fileName}-${candidate.fingerprint}`}
                className="p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{candidate.fileName}</span>
                  {candidate.duplicate && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                      Duplicate
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {candidate.parsedChat.messages.length.toLocaleString()}{" "}
                  messages · {candidate.parsedChat.participants.length}{" "}
                  participants · {candidate.firstDate} to {candidate.lastDate}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="tool-button"
              disabled={
                loading || prepared.every((candidate) => candidate.duplicate)
              }
              onClick={() => void importPrepared()}
            >
              Import{" "}
              {prepared.filter((candidate) => !candidate.duplicate).length} chat
              {prepared.filter((candidate) => !candidate.duplicate).length === 1
                ? ""
                : "s"}
            </button>
            <button
              type="button"
              className="tool-button-secondary"
              onClick={resetSelection}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mx-auto mt-5 max-w-3xl text-left" aria-live="polite">
          <h2 className="text-sm font-semibold">Import results</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {results.map((result, index) => (
              <li key={`${result.fileName}-${index}`}>
                <span
                  className={
                    result.status === "imported"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : result.status === "duplicate"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-destructive"
                  }
                >
                  {result.fileName}:
                </span>{" "}
                <span className="text-muted-foreground">{result.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <details className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Import another chat
        </summary>
        <div className="mt-3">{uploadContent}</div>
      </details>
    );
  }

  return <div className="tool-panel">{uploadContent}</div>;
}
