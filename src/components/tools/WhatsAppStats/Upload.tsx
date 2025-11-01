import JSZip from "jszip";
import { useEffect, useState } from "react";
import { isClearedAtom, isDataUploadedAtom, whatsappDB } from "./db";
import { useAtom, useSetAtom } from "jotai";

export function HandlewhatsappData() {
  const [isCleared, setIsCleared] = useAtom(isClearedAtom);
  const setIsDataUploaded = useSetAtom(isDataUploadedAtom);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      const chatId = await whatsappDB.chats.add({
        name: file.name + " - " + new Date().toDateString(),
      });

      await processTextData(text, chatId);
    } catch (err) {
      setError("Error reading file content");
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
    for (const file of validFiles) {
      await readFileContent(file);
    }
    setLoading(false);
    setFiles([]); // Clear selected files after upload
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
    for (const file of droppedFiles) {
      await readFileContent(file);
    }
    setLoading(false);
    setFiles([]); // Clear selected files after upload
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const isSystemMessage = (message: string): boolean => {
    // Common system message patterns (excluding media messages which we want to track)
    const systemPatterns = [
      /^‎?You (created|changed|added|removed|left|joined)/,
      /^‎?.*? (was|were) (added|removed)/,
      /^‎?.*? (joined|left) using this group's invite link/,
      /^‎?.*? changed (their|the group)/,
      /^‎?Security code changed/,
      /^‎?Messages and calls are end-to-end encrypted/,
      /^‎?This chat is with a business account/,
      /^‎?Disappearing messages/,
      /^‎?Missed (voice|video) call$/i,
      /^‎?Call ended$/i,
    ];

    return systemPatterns.some((pattern) => pattern.test(message.trim()));
  };

  const isMediaMessage = (message: string): boolean => {
    // Media message patterns for both formats
    const mediaPatterns = [
      /^‎?(image|video|audio|document|sticker|gif|contact|location) omitted$/i,
      /^‎?<Media omitted>$/i,
    ];

    return mediaPatterns.some((pattern) => pattern.test(message.trim()));
  };

  const extractParticipants = (lines: string[]) => {
    const uniqueParticipants = new Set<string>();

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.includes(": ")) return;

      // Check for macOS format first: [28.10.24, 10:54:02] username: message
      if (trimmedLine.match(/^\[\d{2}\.\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}\]/)) {
        const match = trimmedLine.match(
          /^\[\d{2}\.\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}\] ([^:]+): (.*)$/,
        );
        if (match && match[1] && match[2]) {
          const user = match[1].trim();
          const message = match[2].trim();

          // Additional validation: user should not contain newlines or time patterns
          if (
            !user.includes("\n") &&
            !user.match(/\d{1,2}:\d{2}/) && // No time patterns in username
            !user.startsWith("‎") &&
            (!isSystemMessage(message) || isMediaMessage(message)) && // Allow media messages even if they match system patterns
            !user.toLowerCase().includes("system") &&
            user !== "WhatsApp" &&
            user.length < 100
          ) {
            // Reasonable username length limit
            uniqueParticipants.add(user);
          }
        }
      }
      // Android format: 28/10/2024, 10:53 - username: message
      else if (trimmedLine.match(/^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}/)) {
        const [datePlusUser, ...messageParts] = trimmedLine.split(": ");
        if (
          datePlusUser &&
          datePlusUser.includes(" - ") &&
          messageParts.length > 0
        ) {
          const user = datePlusUser.split(" - ")[1].trim();
          const messageContent = messageParts.join(": ");

          // Additional validation: user should not contain newlines or be too long
          if (
            !user.includes("\n") &&
            !user.startsWith("‎") &&
            (!isSystemMessage(messageContent) ||
              isMediaMessage(messageContent)) && // Allow media messages even if they match system patterns
            !user.toLowerCase().includes("system") &&
            user !== "WhatsApp" &&
            user !== "You" &&
            user.length < 100
          ) {
            // Reasonable username length limit
            uniqueParticipants.add(user);
          }
        }
      }
    });

    const participantsList = Array.from(uniqueParticipants);
    return participantsList;
  };

  const filterMessages = (lines: string[], participants: string[]) => {
    const filteredMessages: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || !line.includes(": ")) continue;

      let isValidMessage = false;
      let user = "";
      let messageContent = "";

      // Check for macOS format first: [28.10.24, 10:54:02] username: message
      if (line.match(/^\[\d{2}\.\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}\]/)) {
        const match = line.match(
          /^\[\d{2}\.\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}\] ([^:]+): (.*)$/,
        );
        if (match && match[1] && match[2]) {
          user = match[1].trim();
          messageContent = match[2].trim();

          // Strict validation for macOS format
          isValidMessage =
            participants.includes(user) &&
            !user.includes("\n") && // Username should not contain newlines
            !user.match(/\d{1,2}:\d{2}/) && // No time patterns in username
            !user.startsWith("‎") &&
            (!isSystemMessage(messageContent) ||
              isMediaMessage(messageContent)) && // Allow media messages
            !user.toLowerCase().includes("system") &&
            user !== "WhatsApp" &&
            user.length < 100; // Reasonable username length
        }
      }
      // Android format: 28/10/2024, 10:53 - username: message
      else if (line.match(/^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}/)) {
        const [datePlusUser, ...messageParts] = line.split(": ");
        if (
          datePlusUser &&
          datePlusUser.includes(" - ") &&
          messageParts.length > 0
        ) {
          user = datePlusUser.split(" - ")[1].trim();
          messageContent = messageParts.join(": "); // Rejoin in case message contains ":"

          // Strict validation for Android format
          isValidMessage =
            participants.includes(user) &&
            !user.includes("\n") && // Username should not contain newlines
            !user.startsWith("‎") &&
            (!isSystemMessage(messageContent) ||
              isMediaMessage(messageContent)) && // Allow media messages
            !user.toLowerCase().includes("system") &&
            user !== "WhatsApp" &&
            user !== "You" &&
            user.length < 100; // Reasonable username length
        }
      }

      if (isValidMessage) {
        // Collect the main message line
        let fullMessage = line;

        // Check for continuation lines (multi-line messages)
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (!nextLine) {
            j++;
            continue;
          }

          // If next line doesn't start with a timestamp, it's a continuation
          const isMacOSTimestamp = nextLine.match(
            /^\[\d{2}\.\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}\]/,
          );
          const isAndroidTimestamp = nextLine.match(
            /^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}/,
          );

          if (!isMacOSTimestamp && !isAndroidTimestamp) {
            // Skip lines that start with special characters (like ‎) as they might be system messages
            if (!nextLine.startsWith("‎")) {
              fullMessage += "\n" + nextLine;
            }
            j++;
          } else {
            break;
          }
        }

        filteredMessages.push(fullMessage);
        i = j - 1; // Skip the lines we've already processed
      }
    }

    return filteredMessages;
  };

  const processTextData = async (text: string, chatId: number) => {
    const lines = text.split("\n");
    const participantsList = extractParticipants(lines);
    whatsappDB.persons.bulkAdd(
      participantsList.map((name) => ({ name, chatId })),
    );
    const persons = await whatsappDB.persons
      .where({ chatId: chatId })
      .toArray();
    const filtered = filterMessages(lines, participantsList);

    whatsappDB.messages.bulkAdd(
      filtered
        .map((msg: string) => {
          // Split message to get first line (with timestamp) and potentially multi-line content
          const lines = msg.split("\n");
          const firstLine = lines[0];
          const messageLines = lines.slice(1);

          // Check for macOS format first: [28.10.24, 10:54:02] username: message
          if (firstLine.match(/^\[\d{2}\.\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}\]/)) {
            const match = firstLine.match(
              /^\[(\d{2}\.\d{2}\.\d{2}), (\d{2}:\d{2}:\d{2})\] ([^:]+): (.*)$/,
            );
            if (match) {
              const [, date, time, user, firstMessagePart] = match;
              // Convert date format from DD.MM.YY to DD/MM/YYYY
              const dateParts = date.split(".");
              const fullYear = "20" + dateParts[2]; // Convert YY to YYYY
              const formattedDate = `${dateParts[0]}/${dateParts[1]}/${fullYear}`;

              // Combine first message part with continuation lines
              let fullMessageContent = firstMessagePart;
              if (messageLines.length > 0) {
                fullMessageContent += "\n" + messageLines.join("\n");
              }

              // Clean message content (remove editing indicators, etc.)
              fullMessageContent = fullMessageContent
                .replace(/<This message was edited>$/i, "")
                .replace(/‎/g, "") // Remove invisible characters
                .trim();

              // Skip if message is empty after cleaning, but keep media messages
              if (
                !fullMessageContent ||
                (isSystemMessage(fullMessageContent) &&
                  !isMediaMessage(fullMessageContent))
              ) {
                return null;
              }

              return {
                personId: persons.find((p) => p.name === user)?.id || 0,
                time: time,
                date: formattedDate,
                text: fullMessageContent,
                year: Number(fullYear),
                chatId: chatId,
              };
            }
          }

          // Android format: 28/10/2024, 10:53 - username: message
          const [datePlusUser, ...messageParts] = firstLine.split(": ");
          const [dateTime, user] = datePlusUser
            .split(" - ")
            .map((s) => s.trim());
          const [date, time] = dateTime.split(", ");

          // Combine first message part with continuation lines
          let fullMessageContent = messageParts.join(": "); // Rejoin in case message contains ":"
          if (messageLines.length > 0) {
            fullMessageContent += "\n" + messageLines.join("\n");
          }

          // Clean message content (remove editing indicators, etc.)
          fullMessageContent = fullMessageContent
            .replace(/<This message was edited>$/i, "")
            .replace(/‎/g, "") // Remove invisible characters
            .trim();

          // Skip if message is empty after cleaning, but keep media messages
          if (
            !fullMessageContent ||
            (isSystemMessage(fullMessageContent) &&
              !isMediaMessage(fullMessageContent))
          ) {
            return null;
          }

          return {
            personId: persons.find((p) => p.name === user)?.id || 0,
            time: time,
            date: date,
            text: fullMessageContent,
            year: Number(date.slice(-4)),
            chatId: chatId,
          };
        })
        .filter(
          (message): message is NonNullable<typeof message> => message !== null,
        ),
    );
    setIsDataUploaded(true);
  };

  useEffect(() => {
    if (isCleared) {
      setFiles([]);
      setError(null);
      setIsCleared(false);
      setIsDataUploaded(false);
    }
  }, [isCleared]);

  useEffect(() => {
    // Check message count on mount (for potential future use)
    const messageCount = whatsappDB.chats.count();
    void messageCount;
  }, []);

  return (
    <div>
      <div
        className="rounded-lg border-2 border-dashed p-4 text-center sm:p-8"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".txt,.zip"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer text-primary hover:underline"
        >
          Choose files
        </label>
        <p className="mt-2 text-sm text-muted-foreground">
          or drag and drop your WhatsApp chat exports here (supports both
          Android and macOS exports)
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {files.length > 0 && (
          <ul className="mt-2 text-sm text-green-500">
            {files.map((file) => (
              <li key={file.name}>Selected file: {file.name}</li>
            ))}
          </ul>
        )}
        {loading && (
          <div className="mt-4 w-full">
            <div className="h-2 rounded bg-gray-200">
              <div
                className="h-2 animate-pulse rounded bg-primary"
                style={{ width: "100%" }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Importing, please wait...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
