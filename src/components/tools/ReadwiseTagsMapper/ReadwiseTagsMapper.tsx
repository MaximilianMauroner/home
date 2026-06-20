"use client";
import { useEffect, useState } from "react";
import { DocumentList } from "./components/DocumentList";
import { SessionStatus } from "./components/SessionStatus";
import { StatusToast } from "./components/StatusToast";
import { TagWorkspace } from "./components/TagWorkspace";
import { TokenControls } from "./components/TokenControls";
import type {
  AuthStatus,
  FetchedDocument,
  StatusMessage,
} from "./components/types";
import { WorkflowControls } from "./components/WorkflowControls";
import type { ReadwiseItem } from "./utils/types";

function ReadwiseTagsMapper() {
  const [tokenInput, setTokenInput] = useState<string>("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("unknown");
  const [authMessage, setAuthMessage] = useState<StatusMessage | null>(null);
  const [isSavingToken, setIsSavingToken] = useState<boolean>(false);
  const [isTestingToken, setIsTestingToken] = useState<boolean>(false);
  const [isClearingToken, setIsClearingToken] = useState<boolean>(false);
  const [runSingle, setRunSingle] = useState<boolean>(false);
  const [documentId, setDocumentId] = useState<string>("");

  // batch options
  const [locations, setLocations] = useState<string[]>(["archive"]);
  const [categories, setCategories] = useState<string[]>(["article"]);

  const [extractedTags, setExtractedTags] = useState<string[]>([]);
  const [documentTags, setDocumentTags] = useState<string[]>([]);
  const [fetchedDocs, setFetchedDocs] = useState<FetchedDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDocUrl, setActiveDocUrl] = useState<string | null>(null);

  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [sampleText, setSampleText] = useState<string>("");

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null,
  );
  const [isFetchingSingle, setIsFetchingSingle] = useState<boolean>(false);
  const [isFetchingBatch, setIsFetchingBatch] = useState<boolean>(false);
  const [isUpdatingTags, setIsUpdatingTags] = useState<boolean>(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isFilteringAligned, setIsFilteringAligned] = useState<boolean>(true);

  useEffect(() => {
    const fetchSessionStatus = async () => {
      try {
        const res = await fetch("/api/tools/readwise-tags-mapper/session");
        if (!res.ok) {
          throw new Error("Failed to retrieve session status");
        }
        const data = (await res.json()) as { authenticated: boolean };
        setAuthStatus(data.authenticated ? "authenticated" : "missing");
      } catch {
        setAuthStatus("missing");
      }
    };

    void fetchSessionStatus();
  }, []);

  useEffect(() => {
    if (runSingle) {
      setFiltersExpanded(false);
    }
  }, [runSingle]);

  const handleUnauthorized = (
    message = "Your Readwise token is missing or invalid. Please set it before continuing.",
  ) => {
    setAuthStatus("missing");
    setAuthMessage({ text: message, tone: "error" });
    setStatusMessage({ text: message, tone: "error" });
  };

  async function handleTokenSave() {
    const trimmedToken = tokenInput.trim();
    if (!trimmedToken) {
      setAuthMessage({
        text: "Enter a token before saving.",
        tone: "error",
      });
      setStatusMessage({ text: "Enter a token before saving.", tone: "error" });
      return;
    }

    setIsSavingToken(true);
    setAuthMessage(null);
    setStatusMessage({ text: "Saving token…", tone: "info" });

    try {
      const res = await fetch("/api/tools/readwise-tags-mapper/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: trimmedToken }),
      });

      if (res.status === 204) {
        setAuthStatus("authenticated");
        setTokenInput("");
        setAuthMessage({
          text: "Token saved and validated successfully.",
          tone: "success",
        });
        setStatusMessage({
          text: "Token saved and validated successfully.",
          tone: "success",
        });
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        data?.error ?? `Failed to save token (status ${res.status}).`,
      );
    } catch (error) {
      setAuthStatus("missing");
      setAuthMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to save token. Please try again.",
        tone: "error",
      });
      setStatusMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to save token. Please try again.",
        tone: "error",
      });
    } finally {
      setIsSavingToken(false);
    }
  }

  async function handleTestToken(useEnteredToken: boolean) {
    const trimmedToken = tokenInput.trim();
    if (useEnteredToken && !trimmedToken) {
      setAuthMessage({
        text: "Enter a token to test.",
        tone: "error",
      });
      setStatusMessage({ text: "Enter a token to test.", tone: "error" });
      return;
    }

    setIsTestingToken(true);
    setAuthMessage(null);
    setStatusMessage({ text: "Validating token…", tone: "info" });

    try {
      const init: RequestInit = {
        method: "POST",
      };

      if (useEnteredToken) {
        init.headers = {
          "Content-Type": "application/json",
        };
        init.body = JSON.stringify({ token: trimmedToken });
      }

      const res = await fetch(
        "/api/tools/readwise-tags-mapper/session/test",
        init,
      );

      if (res.status === 204) {
        setAuthStatus("authenticated");
        setAuthMessage({
          text: useEnteredToken ? "Token is valid." : "Stored token is valid.",
          tone: "success",
        });
        setStatusMessage({
          text: useEnteredToken
            ? "Token is valid. You're good to go."
            : "Stored token is valid.",
          tone: "success",
        });
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        data?.error ?? `Token validation failed (status ${res.status}).`,
      );
    } catch (error) {
      if (!useEnteredToken) {
        setAuthStatus("missing");
      }
      setAuthMessage({
        text:
          error instanceof Error
            ? error.message
            : "Token validation failed. Please try again.",
        tone: "error",
      });
      setStatusMessage({
        text:
          error instanceof Error
            ? error.message
            : "Token validation failed. Please try again.",
        tone: "error",
      });
    } finally {
      setIsTestingToken(false);
    }
  }

  async function handleClearToken() {
    setIsClearingToken(true);
    setAuthMessage(null);
    setStatusMessage({ text: "Clearing stored token…", tone: "info" });

    try {
      const res = await fetch("/api/tools/readwise-tags-mapper/session", {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to clear token (status ${res.status}).`);
      }

      setAuthStatus("missing");
      setAuthMessage({
        text: "Stored token removed.",
        tone: "info",
      });
      setStatusMessage({ text: "Stored token removed.", tone: "info" });
    } catch (error) {
      setAuthMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to clear token. Please try again.",
        tone: "error",
      });
      setStatusMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to clear token. Please try again.",
        tone: "error",
      });
    } finally {
      setIsClearingToken(false);
    }
  }

  function toggleLocation(loc: string) {
    setLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    );
    setCursor(null);
    setNextCursor(null);
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((t) => t !== cat) : [...prev, cat],
    );
    setCursor(null);
    setNextCursor(null);
  }

  function toggleDocSelection(docId: string) {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }

  function clearDocSelection() {
    setSelectedDocIds(new Set());
  }

  function toggleSelectedTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  function openSelectedDocs() {
    if (selectedDocIds.size === 0) {
      setStatusMessage({
        text: "Select at least one document with a Readwise URL to open.",
        tone: "error",
      });
      return;
    }

    const docsToOpen = fetchedDocs.filter(({ doc }) =>
      selectedDocIds.has(doc.id),
    );

    if (docsToOpen.length === 0) {
      setStatusMessage({
        text: "Selected documents are no longer in the list. Refresh and select again.",
        tone: "error",
      });
      clearDocSelection();
      return;
    }

    const docsWithUrl = docsToOpen.filter(({ doc }) => Boolean(doc.url));

    if (docsWithUrl.length === 0) {
      setStatusMessage({
        text: "None of the selected documents include a Readwise link to open.",
        tone: "error",
      });
      return;
    }

    docsWithUrl.forEach(({ doc }) => {
      if (doc.url) {
        window.open(doc.url, "_blank", "noopener");
      }
    });

    const skipped = docsToOpen.length - docsWithUrl.length;
    setStatusMessage({
      text:
        `Opening ${docsWithUrl.length} document${
          docsWithUrl.length > 1 ? "s" : ""
        } in new tabs.` +
        (skipped > 0
          ? ` ${skipped} selection${
              skipped > 1 ? "s" : ""
            } skipped—no URL available.`
          : ""),
      tone: "success",
    });
  }

  async function handleFetchSingle() {
    const trimmedId = documentId.trim();
    if (!trimmedId) {
      setStatusMessage({
        text: "Enter a document ID before fetching.",
        tone: "error",
      });
      return;
    }
    setIsFetchingSingle(true);
    setStatusMessage({ text: "Fetching document…", tone: "info" });
    try {
      const url = new URL(
        "/api/tools/readwise-tags-mapper/fetch/" + trimmedId,
        location.href,
      );
      const res = await fetch(url);

      if (res.status === 401) {
        handleUnauthorized(
          "Please set a valid Readwise access token before fetching documents.",
        );
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch document (status ${res.status}).`);
      }

      const data = (await res.json()) as {
        doc: ReadwiseItem;
        tags: string[];
      };
      setSampleText(data.doc?.summary || "");
      data.tags.sort((a, b) => a.localeCompare(b));
      setExtractedTags(data.tags);

      const tags = data.doc ? Object.keys(data.doc.tags) : [];

      tags.sort((a, b) => a.localeCompare(b));

      const tagSet = new Set(data.tags);
      setSelectedTags(tagSet);
      if (data.doc) {
        setActiveDocId(data.doc.id);
        setActiveDocUrl(data.doc.url ?? null);
      } else {
        setActiveDocId(null);
        setActiveDocUrl(null);
      }
      setStatusMessage({
        text: data.doc
          ? "Document loaded. Review the summary and tag differences."
          : "No document found, but extracted tags are available below.",
        tone: data.doc ? "success" : "info",
      });
    } catch (error) {
      console.error(error);
      setAuthMessage({
        text:
          error instanceof Error ? error.message : "Failed to fetch document.",
        tone: "error",
      });
      setStatusMessage({
        text:
          error instanceof Error ? error.message : "Failed to fetch document.",
        tone: "error",
      });
    } finally {
      setIsFetchingSingle(false);
    }
  }

  async function updateDocumentTags() {
    const idToUpdate = activeDocId ?? documentId;
    if (!idToUpdate) {
      setStatusMessage({
        text: "Select a document (or enter its ID) before applying tag updates.",
        tone: "error",
      });
      return;
    }
    setIsUpdatingTags(true);
    setStatusMessage({ text: "Applying tag updates…", tone: "info" });
    try {
      const url = new URL(
        "/api/tools/readwise-tags-mapper/fetch/" + idToUpdate,
        location.href,
      );
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tags: Array.from(selectedTags),
        }),
      });

      if (res.status === 401) {
        handleUnauthorized(
          "Please set a valid Readwise access token before updating tags.",
        );
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to update document (status ${res.status}).`);
      }
      setStatusMessage({
        text: "Tags saved to Readwise.",
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAuthMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to update document tags.",
        tone: "error",
      });
      setStatusMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to update document tags.",
        tone: "error",
      });
    } finally {
      setIsUpdatingTags(false);
    }
  }

  async function handleFetchBatch(pageCursor: string | null = null) {
    setIsFetchingBatch(true);
    setStatusMessage({
      text: pageCursor ? "Fetching next page…" : "Fetching documents…",
      tone: "info",
    });
    try {
      const url = new URL(
        "/api/tools/readwise-tags-mapper/multi-fetch",
        location.href,
      );
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locations,
          categories,
          cursor: pageCursor,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized(
          "Please set a valid Readwise access token before fetching documents.",
        );
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch documents (status ${res.status}).`);
      }

      const data = (await res.json()) as {
        docs: {
          doc: ReadwiseItem;
          tags: string[];
        }[];
        nextPageCursor: string | null;
      };
      setCursor(pageCursor);
      setNextCursor(data.nextPageCursor);
      setFetchedDocs(data.docs);
      clearDocSelection();
      if (data.docs.length > 0) {
        const firstWithDoc = data.docs.find((entry) => entry.doc);
        if (firstWithDoc?.doc) {
          loadDocIntoPane(firstWithDoc.doc, firstWithDoc.tags);
          setStatusMessage({
            text: `Fetched ${data.docs.length} document${
              data.docs.length > 1 ? "s" : ""
            }${data.nextPageCursor ? ". Another page is available" : ""}. Loaded “${
              firstWithDoc.doc.title ?? "first document"
            }” for review.`,
            tone: "success",
          });
        } else {
          setStatusMessage({
            text: `Fetched ${data.docs.length} document${
              data.docs.length > 1 ? "s" : ""
            }, but none contained document details. Please try again.`,
            tone: "error",
          });
        }
      } else {
        setStatusMessage({
          text: "No documents matched those filters. Try adjusting and fetch again.",
          tone: "info",
        });
      }
    } catch (error) {
      console.error(error);
      setAuthMessage({
        text:
          error instanceof Error ? error.message : "Failed to fetch documents.",
        tone: "error",
      });
      setStatusMessage({
        text:
          error instanceof Error ? error.message : "Failed to fetch documents.",
        tone: "error",
      });
    } finally {
      setIsFetchingBatch(false);
    }
  }

  function loadDocIntoPane(doc: ReadwiseItem, docTags: string[]) {
    setActiveDocId(doc.id);
    setActiveDocUrl(doc.url ?? null);
    setDocumentId(doc.id);
    setSampleText(doc.summary || "");
    const existing = doc?.tags ? Object.keys(doc.tags) : (docTags ?? []);
    existing.sort((a, b) => a.localeCompare(b));
    setDocumentTags(existing);
    const tagSet = new Set(docTags);
    (docTags ?? []).forEach((t) => tagSet.add(t));
    setSelectedTags(tagSet);
    setExtractedTags(
      (docTags ?? []).slice().sort((a, b) => a.localeCompare(b)),
    );
  }

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col gap-2 lg:gap-4">
        <SessionStatus authStatus={authStatus} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)] xl:grid-cols-[minmax(0,0.55fr)_minmax(0,0.45fr)]">
          <TokenControls
            authMessage={authMessage}
            authStatus={authStatus}
            isClearingToken={isClearingToken}
            isSavingToken={isSavingToken}
            isTestingToken={isTestingToken}
            onClearToken={handleClearToken}
            onSaveToken={handleTokenSave}
            onSetTokenInput={setTokenInput}
            onTestToken={handleTestToken}
            tokenInput={tokenInput}
          />

          <WorkflowControls
            categories={categories}
            cursor={cursor}
            documentId={documentId}
            filtersExpanded={filtersExpanded}
            isFetchingBatch={isFetchingBatch}
            isFetchingSingle={isFetchingSingle}
            locations={locations}
            nextCursor={nextCursor}
            onFetchBatch={() => handleFetchBatch(null)}
            onFetchNextBatch={() => {
              if (nextCursor) {
                void handleFetchBatch(nextCursor);
              }
            }}
            onFetchSingle={handleFetchSingle}
            onSetDocumentId={setDocumentId}
            onSetFiltersExpanded={setFiltersExpanded}
            onSetRunSingle={setRunSingle}
            onToggleCategory={toggleCategory}
            onToggleLocation={toggleLocation}
            runSingle={runSingle}
          />
        </div>

        <div className="flex flex-col gap-5 lg:flex-row">
          <DocumentList
            activeDocId={activeDocId}
            documentId={documentId}
            fetchedDocs={fetchedDocs}
            isFilteringAligned={isFilteringAligned}
            onClearSelection={clearDocSelection}
            onLoadDoc={loadDocIntoPane}
            onOpenSelectedDocs={openSelectedDocs}
            onToggleFilteringAligned={() =>
              setIsFilteringAligned((prev) => !prev)
            }
            onToggleSelection={toggleDocSelection}
            selectedDocIds={selectedDocIds}
          />

          <TagWorkspace
            activeDocId={activeDocId}
            activeDocUrl={activeDocUrl}
            documentId={documentId}
            documentTags={documentTags}
            extractedTags={extractedTags}
            isUpdatingTags={isUpdatingTags}
            onToggleTag={toggleSelectedTag}
            onUpdateDocumentTags={updateDocumentTags}
            sampleText={sampleText}
            selectedTags={selectedTags}
          />
        </div>
      </div>
      {statusMessage && (
        <StatusToast
          message={statusMessage}
          onDismiss={() => setStatusMessage(null)}
        />
      )}
    </div>
  );
}

export default ReadwiseTagsMapper;
