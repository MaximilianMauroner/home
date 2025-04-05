import JSZip from "jszip";
import { useEffect, useState } from "react";
import { whatsappDB } from "../db";

export function HandlewhatsappData() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(false);

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

  // Update extractParticipants to store original names but display anonymized ones
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
  const processTextData = async (text: string) => {
    const lines = text.split("\n");
    const participantsList = extractParticipants(lines);
    whatsappDB.persons.clear();
    whatsappDB.persons.bulkAdd(participantsList.map((name) => ({ name })));
    const persons = await whatsappDB.persons.toArray();
    const filtered = filterMessages(lines, participantsList);

    whatsappDB.chats.clear();
    whatsappDB.chats.bulkAdd(
      filtered.map((msg: string) => {
        const [datePlusUser, messageContent] = msg.split(": ");
        const [dateTime, user] = datePlusUser.split(" - ").map((s) => s.trim());
        const [date, time] = dateTime.split(", ");
        console.log("date", date);
        console.log("time", time);

        return {
          personId: persons.find((p) => p.name === user)?.id || 0,
          time: time,
          date: date,
          text: messageContent,
        };
      }),
    );
  };

  useEffect(() => {
    const messageCount = whatsappDB.chats.count();
    const fetchMessageCount = async () => {
      const count = await messageCount;
      setHasMessages(count > 0);
    };
    fetchMessageCount();
  }, []);

  if (hasMessages) {
    return (
      <div>
        <p className="text-green-500">Data processed successfully!</p>
      </div>
    );
  }

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
          or drag and drop your WhatsApp chat export here (doesn't work with Mac
          Whatsapp Export)
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {file && (
          <p className="mt-2 text-sm text-green-500">
            Selected file: {file.name}
          </p>
        )}
      </div>
    </div>
  );
}
