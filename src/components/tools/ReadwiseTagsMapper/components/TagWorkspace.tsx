interface TagWorkspaceProps {
  activeDocId: string | null;
  activeDocUrl: string | null;
  documentId: string;
  documentTags: string[];
  extractedTags: string[];
  isUpdatingTags: boolean;
  onToggleTag: (tag: string) => void;
  onUpdateDocumentTags: () => void;
  sampleText: string;
  selectedTags: Set<string>;
}

export function TagWorkspace({
  activeDocId,
  activeDocUrl,
  documentId,
  documentTags,
  extractedTags,
  isUpdatingTags,
  onToggleTag,
  onUpdateDocumentTags,
  sampleText,
  selectedTags,
}: TagWorkspaceProps) {
  return (
    <section className="tool-panel-lg flex min-w-0 flex-1 flex-col gap-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Tag update workspace
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-gray-500 dark:text-gray-400">
              {activeDocId || documentId || "No document selected"}
            </span>
            {activeDocUrl && (
              <a
                href={activeDocUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 font-semibold text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/20"
              >
                Open in Readwise
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="tool-label block">Document summary</label>
        <textarea
          value={sampleText}
          readOnly
          rows={8}
          className="tool-field h-[400px] w-full resize-none leading-relaxed"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TagGroup
          label="Existing tags"
          emptyMessage="No tags on this document yet."
          tags={documentTags}
          selectedTags={selectedTags}
          onToggleTag={onToggleTag}
        />
        <TagGroup
          label="Extracted tags"
          emptyMessage="No tags extracted yet."
          tags={extractedTags}
          selectedTags={selectedTags}
          onToggleTag={onToggleTag}
        />
      </div>

      <div className="border-t border-gray-200 pt-4 dark:border-neutral-800">
        <button
          onClick={onUpdateDocumentTags}
          type="submit"
          disabled={isUpdatingTags}
          className="tool-button w-full py-3 text-base"
        >
          {isUpdatingTags ? "Saving tags..." : "Apply tag updates"}
        </button>
      </div>
    </section>
  );
}

interface TagGroupProps {
  emptyMessage: string;
  label: string;
  onToggleTag: (tag: string) => void;
  selectedTags: Set<string>;
  tags: string[];
}

function TagGroup({
  emptyMessage,
  label,
  onToggleTag,
  selectedTags,
  tags,
}: TagGroupProps) {
  return (
    <div className="space-y-3">
      <label className="tool-label block">{label}</label>
      <div className="flex min-h-[64px] flex-wrap gap-2 rounded-lg border border-border bg-background px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        {tags.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {emptyMessage}
          </span>
        ) : (
          tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                selectedTags.has(tag)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-indigo-100 bg-indigo-50 text-indigo-700 hover:border-indigo-300 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
              }`}
            >
              #{tag}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
