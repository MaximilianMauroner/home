import { Check, Plus } from "lucide-react";
import type { ReadwiseItem } from "../utils/types";
import type { FetchedDocument } from "./types";

interface DocumentListProps {
  activeDocId: string | null;
  documentId: string;
  fetchedDocs: FetchedDocument[];
  isFilteringAligned: boolean;
  onClearSelection: () => void;
  onLoadDoc: (doc: ReadwiseItem, docTags: string[]) => void;
  onOpenSelectedDocs: () => void;
  onToggleFilteringAligned: () => void;
  onToggleSelection: (docId: string) => void;
  selectedDocIds: Set<string>;
}

export function DocumentList({
  activeDocId,
  documentId,
  fetchedDocs,
  isFilteringAligned,
  onClearSelection,
  onLoadDoc,
  onOpenSelectedDocs,
  onToggleFilteringAligned,
  onToggleSelection,
  selectedDocIds,
}: DocumentListProps) {
  return (
    <aside className="tool-panel flex-shrink-0 space-y-4 overflow-hidden lg:sticky lg:top-8 lg:h-[calc(100vh-260px)] lg:w-80">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Fetched documents
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a document to review its tags
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px] font-medium">
          <span className="inline-flex w-max items-center gap-1 rounded-md bg-indigo-100 px-2 py-1 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
            {fetchedDocs.length} total
          </span>
          {selectedDocIds.size > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/20"
            >
              {selectedDocIds.size} selected - clear
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSelectedDocs}
        disabled={selectedDocIds.size === 0}
        className="tool-button-secondary w-full"
      >
        Open selected in Readwise
        {selectedDocIds.size > 0 && (
          <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
            {selectedDocIds.size}
          </span>
        )}
      </button>
      <button
        onClick={onToggleFilteringAligned}
        className="tool-button-secondary w-full"
      >
        {isFilteringAligned ? "Unfilter" : "Filter"} Aligned
      </button>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto pb-24 pr-1">
        {fetchedDocs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground dark:border-neutral-800 dark:bg-neutral-950">
            No documents yet. Run a fetch to populate this list.
          </div>
        ) : (
          fetchedDocs.map(({ doc, tags: docTags }) => {
            const existing = doc?.tags
              ? Object.keys(doc.tags).sort((a, b) => a.localeCompare(b))
              : [];
            const extracted = (docTags ?? [])
              .slice()
              .sort((a, b) => a.localeCompare(b));
            const existingSet = new Set(existing);
            const extractedSet = new Set(extracted);
            const suggestedTags = extracted.filter(
              (tag) => !existingSet.has(tag),
            );
            const overlapTags = extracted.filter((tag) => existingSet.has(tag));

            const isActive = activeDocId === doc.id || documentId === doc.id;
            const isSelected = selectedDocIds.has(doc.id);
            const hasDiff = extractedSet.size === 0 || suggestedTags.length > 0;

            if (!hasDiff && isFilteringAligned) {
              return null;
            }

            return (
              <DocumentCard
                key={doc.id}
                doc={doc}
                docTags={docTags}
                existing={existing}
                extracted={extracted}
                hasDiff={hasDiff}
                isActive={isActive}
                isSelected={isSelected}
                overlapTags={overlapTags}
                suggestedTags={suggestedTags}
                onLoadDoc={onLoadDoc}
                onToggleSelection={onToggleSelection}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

interface DocumentCardProps {
  doc: ReadwiseItem;
  docTags: string[];
  existing: string[];
  extracted: string[];
  hasDiff: boolean;
  isActive: boolean;
  isSelected: boolean;
  onLoadDoc: (doc: ReadwiseItem, docTags: string[]) => void;
  onToggleSelection: (docId: string) => void;
  overlapTags: string[];
  suggestedTags: string[];
}

function DocumentCard({
  doc,
  docTags,
  existing,
  extracted,
  hasDiff,
  isActive,
  isSelected,
  onLoadDoc,
  onToggleSelection,
  overlapTags,
  suggestedTags,
}: DocumentCardProps) {
  const cardHighlight = isActive
    ? "border-indigo-300 bg-indigo-50/80 dark:border-indigo-500/50 dark:bg-indigo-500/10"
    : isSelected
      ? "border-emerald-400 bg-emerald-50/80 dark:border-emerald-500/60 dark:bg-emerald-500/10"
      : hasDiff
        ? "border-amber-300 bg-amber-50/70 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-500/10 dark:hover:border-amber-400 dark:hover:bg-amber-500/20"
        : "border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500/40";

  return (
    <div
      onClick={() => onLoadDoc(doc, docTags)}
      className={`w-full cursor-pointer rounded-lg border p-4 text-left transition-colors ${cardHighlight}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-800 transition-colors hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-300">
            {doc.title ?? "(no title)"}
          </span>
          <div className="mt-1 line-clamp-2 break-all text-[11px] text-gray-500 dark:text-gray-400">
            {doc.url}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px] font-semibold">
          {hasDiff ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
              Delta {suggestedTags.length} tags
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
              Tags aligned
            </span>
          )}
          {extracted.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-1 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
              {extracted.length} suggestions
            </span>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onToggleSelection(doc.id);
            }}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
              isSelected
                ? "border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-gray-300 dark:hover:border-indigo-500/40"
            }`}
          >
            {isSelected ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Plus className="h-3 w-3" aria-hidden="true" />
            )}
            {isSelected ? "Added" : "Add"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {suggestedTags.length > 0 && (
          <TagPreview
            label="Suggested additions"
            labelClass="text-amber-700"
            tags={suggestedTags}
            maxVisible={5}
            prefix="+"
            tagClass="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
          />
        )}

        {overlapTags.length > 0 && (
          <TagPreview
            label="Shared tags"
            labelClass="text-indigo-600"
            tags={overlapTags}
            maxVisible={4}
            prefix="#"
            tagClass="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200"
          />
        )}

        {extracted.length === 0 && existing.length === 0 && (
          <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
            No tags yet
          </span>
        )}
      </div>
    </div>
  );
}

interface TagPreviewProps {
  label: string;
  labelClass: string;
  maxVisible: number;
  prefix: string;
  tagClass: string;
  tags: string[];
}

function TagPreview({
  label,
  labelClass,
  maxVisible,
  prefix,
  tagClass,
  tags,
}: TagPreviewProps) {
  return (
    <div>
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${labelClass}`}
      >
        {label}
      </span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {tags.slice(0, maxVisible).map((tag) => (
          <span
            key={`${label}-${tag}`}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${tagClass}`}
          >
            {prefix}
            {tag}
          </span>
        ))}
        {tags.length > maxVisible && (
          <span
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${tagClass}`}
          >
            +{tags.length - maxVisible} more
          </span>
        )}
      </div>
    </div>
  );
}
