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
import JSZip from "jszip";
import { whatsappDB } from "../db";
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

export default function WhatsappStats() {
  // Add new state for showing/hiding names
  const [showNames, setShowNames] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  function clearSavedData() {
    whatsappDB.chats.clear();
    whatsappDB.persons.clear();
  }
  return (
    <>
      <div className="mb-4 flex items-center justify-between sm:mb-8">
        {/* <select
        value={selectedYear}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      >
        {availableYears.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select> */}
        <button
          onClick={clearSavedData}
          className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 sm:px-4 sm:py-2"
        >
          Clear Data
        </button>
      </div>
      <HandlewhatsappData />
    </>
  );
}
