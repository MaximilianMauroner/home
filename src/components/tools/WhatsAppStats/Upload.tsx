import JSZip from "jszip";
import { useEffect, useState } from "react";
import {
  isClearedAtom,
  isDataUploadedAtom,
  uploadedChatIdAtom,
  whatsappDB,
} from "./db";
import { useAtom, useSetAtom } from "jotai";
import { runParser } from "./runParser";
import type { ParsedChat } from "./parsing";

export function HandlewhatsappData() {
  const [isCleared, setIsCleared] = useAtom(isClearedAtom);
  const setIsDataUploaded = useSetAtom(isDataUploadedAtom);
  const setUploadedChatId = useSetAtom(uploadedChatIdAtom);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processedFiles, setProcessedFiles] = useState(0);

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
        if (!extractedText) {
          return;
        }
        text = extractedText;
      } else {
        text = await file.text();
      }

      const parsedChat = await runParser(text);
      const chatId = await processParsedChat(parsedChat, file.name);
      setUploadedChatId(chatId);
      setIsDataUploaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error reading file content",
      );
      console.error("Error reading file:", err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.name.endsWith(".txt") || file.name.endsWith(".zip")) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setError("Please upload .txt or .zip files");
      return;
    }

    setError(null);
    setFiles(validFiles);
    setLoading(true);
    setProcessedFiles(0);
    for (const file of validFiles) {
      await readFileContent(file);
      setProcessedFiles((count) => count + 1);
    }
    setLoading(false);
    setFiles([]); // Clear selected files after upload
    setProcessedFiles(0);
    // Also clear the file input value so user can re-upload the same files if needed
    if (e.target) e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.endsWith(".txt") || file.name.endsWith(".zip"),
    );
    if (droppedFiles.length === 0) {
      setError("Please upload .txt or .zip files");
      return;
    }

    setError(null);
    setFiles(droppedFiles);
    setLoading(true);
    setProcessedFiles(0);
    for (const file of droppedFiles) {
      await readFileContent(file);
      setProcessedFiles((count) => count + 1);
    }
    setLoading(false);
    setFiles([]); // Clear selected files after upload
    setProcessedFiles(0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const processParsedChat = async (
    parsedChat: ParsedChat,
    fileName: string,
  ): Promise<number> => {
    if (
      parsedChat.participants.length === 0 ||
      parsedChat.messages.length === 0
    ) {
      throw new Error(
        "No WhatsApp messages found. Check that this is a supported chat export.",
      );
    }

    return await whatsappDB.transaction(
      "rw",
      whatsappDB.chats,
      whatsappDB.persons,
      whatsappDB.messages,
      async () => {
        const chatId = await whatsappDB.chats.add({
          name: fileName + " - " + new Date().toDateString(),
        });

        await whatsappDB.persons.bulkAdd(
          parsedChat.participants.map((name) => ({ name, chatId })),
        );

        const persons = await whatsappDB.persons.where({ chatId }).toArray();
        const personIdByName = new Map(
          persons.map((person) => [person.name, person.id]),
        );

        const messages = parsedChat.messages.map((message) => {
          const personId = personIdByName.get(message.user);
          if (!personId) {
            throw new Error(`Could not match participant "${message.user}".`);
          }

          return {
            personId,
            chatId,
            time: message.time,
            date: message.date,
            text: message.text,
            year: message.year,
          };
        });

        await whatsappDB.messages.bulkAdd(messages);
        return chatId;
      },
    );
  };

  useEffect(() => {
    if (isCleared) {
      setFiles([]);
      setError(null);
      setProcessedFiles(0);
      setIsCleared(false);
      setIsDataUploaded(false);
      setUploadedChatId(null);
    }
  }, [isCleared]);

  useEffect(() => {
    // Check message count on mount (for potential future use)
    const messageCount = whatsappDB.chats.count();
    void messageCount;
  }, []);

  const uploadInputId = "whatsapp-chat-export";
  const uploadHelpId = "whatsapp-upload-help";

  return (
    <div className="tool-panel">
      <div
        className="tool-upload-zone"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          id={uploadInputId}
          type="file"
          accept=".txt,.zip"
          multiple
          onChange={handleFileChange}
          className="sr-only"
          aria-describedby={uploadHelpId}
        />
        <label htmlFor={uploadInputId} className="tool-button cursor-pointer">
          Choose files
        </label>
        <p
          id={uploadHelpId}
          className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground"
        >
          Drag in a WhatsApp chat export, or choose one or more `.txt` or `.zip`
          files from Android or macOS.
        </p>
        <div className="mx-auto mt-5 grid max-w-3xl gap-4 border-t border-border pt-5 text-left text-sm sm:grid-cols-3">
          <div>
            <h2 className="font-semibold text-foreground">Local import</h2>
            <p className="mt-1 leading-6 text-muted-foreground">
              Files are parsed in the browser and stored locally for this tool.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Accepted files</h2>
            <p className="mt-1 leading-6 text-muted-foreground">
              Use the exported chat `.txt` directly or a `.zip` containing that
              text file.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">After import</h2>
            <p className="mt-1 leading-6 text-muted-foreground">
              The dashboard calculates participants, message volume, words, and
              media placeholders.
            </p>
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {files.length > 0 && (
          <ul className="mt-3 text-sm text-emerald-500">
            {files.map((file) => (
              <li key={file.name}>Selected file: {file.name}</li>
            ))}
          </ul>
        )}
        {loading && (
          <output className="mt-4 block w-full" aria-live="polite">
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-[width]"
                style={{
                  width: `${Math.max(
                    5,
                    Math.round(
                      (processedFiles / Math.max(files.length, 1)) * 100,
                    ),
                  )}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Importing {processedFiles} of {files.length} file
              {files.length === 1 ? "" : "s"}.
            </p>
          </output>
        )}
      </div>
    </div>
  );
}
