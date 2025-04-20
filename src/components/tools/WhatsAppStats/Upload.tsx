import JSZip from "jszip";
import { useEffect, useState } from "react";
import { isClearedAtom, isDataUploadedAtom, whatsappDB } from "./db";
import { useAtom } from "jotai";

export function HandlewhatsappData() {
  const [isCleared, setIsCleared] = useAtom(isClearedAtom);
  const [isDataUploaded, setIsDataUploaded] = useAtom(isDataUploadedAtom);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
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
      filtered.map((msg: string) => {
        const [datePlusUser, messageContent] = msg.split(": ");
        const [dateTime, user] = datePlusUser.split(" - ").map((s) => s.trim());
        const [date, time] = dateTime.split(", ");
        return {
          personId: persons.find((p) => p.name === user)?.id || 0,
          time: time,
          date: date,
          text: messageContent,
          year: Number(date.slice(-4)),
          chatId: chatId,
        };
      }),
    );
    setIsDataUploaded(true);
  };

  useEffect(() => {
    if (isCleared) {
      setFiles([]);
      setError(null);
      setIsCleared(false);
      setHasMessages(false);
      setIsDataUploaded(false);
    }
  }, [isCleared]);

  useEffect(() => {
    const messageCount = whatsappDB.chats.count();
    const fetchMessageCount = async () => {
      const count = await messageCount;
      setHasMessages(count > 0);
    };
    fetchMessageCount();
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
          or drag and drop your WhatsApp chat exports here (doesn't work with
          Mac Whatsapp Export)
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
