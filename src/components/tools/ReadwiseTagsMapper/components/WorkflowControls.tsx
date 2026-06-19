import { categoryEnum, locationEnum } from "../utils/types";

interface WorkflowControlsProps {
  categories: string[];
  cursor: string | null | undefined;
  documentId: string;
  filtersExpanded: boolean;
  isFetchingBatch: boolean;
  isFetchingSingle: boolean;
  locations: string[];
  onFetchBatch: () => void;
  onFetchSingle: () => void;
  onSetCursor: (value: string) => void;
  onSetDocumentId: (value: string) => void;
  onSetFiltersExpanded: (expanded: boolean) => void;
  onSetRunSingle: (runSingle: boolean) => void;
  onToggleCategory: (category: string) => void;
  onToggleLocation: (location: string) => void;
  runSingle: boolean;
}

export function WorkflowControls({
  categories,
  cursor,
  documentId,
  filtersExpanded,
  isFetchingBatch,
  isFetchingSingle,
  locations,
  onFetchBatch,
  onFetchSingle,
  onSetCursor,
  onSetDocumentId,
  onSetFiltersExpanded,
  onSetRunSingle,
  onToggleCategory,
  onToggleLocation,
  runSingle,
}: WorkflowControlsProps) {
  const cursorIsSet = Boolean(cursor && cursor.trim());
  const filterCount =
    locations.length + categories.length + (cursorIsSet ? 1 : 0);
  const filterButtonLabel =
    filterCount > 0 ? `Adjust filters (${filterCount})` : "Adjust filters";
  const locationSummary = locations.join(", ");
  const categorySummary = categories.join(", ");

  return (
    <section className="tool-panel flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 lg:text-lg dark:text-gray-100">
            Workflow controls
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1 dark:border-neutral-800 dark:bg-neutral-950">
            <label
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                runSingle
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
            >
              <input
                type="radio"
                name="runMode"
                checked={runSingle}
                onChange={() => onSetRunSingle(true)}
                className="hidden"
              />
              Single
            </label>
            <label
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !runSingle
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
            >
              <input
                type="radio"
                name="runMode"
                checked={!runSingle}
                onChange={() => onSetRunSingle(false)}
                className="hidden"
              />
              Batch
            </label>
          </div>
        </div>
      </div>

      {runSingle ? (
        <div className="flex flex-col gap-3">
          <label className="flex-1">
            <span className="tool-label">Document ID</span>
            <input
              value={documentId}
              onChange={(event) => onSetDocumentId(event.target.value)}
              placeholder="Document ID (e.g. d_123456)"
              className="tool-field mt-1 w-full"
            />
          </label>
          <button
            onClick={onFetchSingle}
            disabled={isFetchingSingle}
            className="tool-button"
          >
            {isFetchingSingle ? "Fetching..." : "Fetch document"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 font-medium text-gray-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-gray-200">
              Locations: {locationSummary}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 font-medium text-gray-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-gray-200">
              Categories: {categorySummary}
            </span>
            {cursorIsSet && (
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 font-medium text-gray-600 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-gray-200">
                Cursor set
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSetFiltersExpanded(!filtersExpanded)}
            className="inline-flex items-center justify-center self-start rounded-md border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10"
          >
            {filtersExpanded ? "Hide filters" : filterButtonLabel}
          </button>

          {filtersExpanded && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
              <FilterOptions
                label="Locations"
                options={Object.keys(locationEnum.enum)}
                selectedOptions={locations}
                hoverClass="hover:border-teal-300 dark:hover:border-teal-400"
                onToggle={onToggleLocation}
              />

              <FilterOptions
                label="Categories"
                options={Object.keys(categoryEnum.enum)}
                selectedOptions={categories}
                hoverClass="hover:border-pink-300 dark:hover:border-pink-400"
                onToggle={onToggleCategory}
              />

              <div className="space-y-2">
                <span className="tool-label block">Cursor (optional)</span>
                <input
                  type="text"
                  value={cursor ?? ""}
                  onChange={(event) => onSetCursor(event.target.value)}
                  placeholder="Cursor"
                  className="tool-field w-full"
                />
              </div>
            </div>
          )}

          <button
            onClick={onFetchBatch}
            disabled={isFetchingBatch}
            className="tool-button"
          >
            {isFetchingBatch ? "Fetching..." : "Fetch documents"}
          </button>
        </div>
      )}
    </section>
  );
}

interface FilterOptionsProps {
  hoverClass: string;
  label: string;
  onToggle: (option: string) => void;
  options: string[];
  selectedOptions: string[];
}

function FilterOptions({
  hoverClass,
  label,
  onToggle,
  options,
  selectedOptions,
}: FilterOptionsProps) {
  return (
    <div className="space-y-2">
      <span className="tool-label block">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onToggle(option)}
            className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
              selectedOptions.includes(option)
                ? "border-primary bg-primary text-primary-foreground"
                : `border-gray-200 bg-white text-gray-700 ${hoverClass} dark:border-neutral-800 dark:bg-neutral-900 dark:text-gray-200`
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
