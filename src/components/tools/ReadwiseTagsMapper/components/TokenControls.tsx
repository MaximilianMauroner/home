import type { AuthStatus, StatusMessage } from "./types";

interface TokenControlsProps {
  authStatus: AuthStatus;
  authMessage: StatusMessage | null;
  isClearingToken: boolean;
  isSavingToken: boolean;
  isTestingToken: boolean;
  onClearToken: () => void;
  onSaveToken: () => void;
  onSetTokenInput: (value: string) => void;
  onTestToken: (useEnteredToken: boolean) => void;
  tokenInput: string;
}

export function TokenControls({
  authStatus,
  authMessage,
  isClearingToken,
  isSavingToken,
  isTestingToken,
  onClearToken,
  onSaveToken,
  onSetTokenInput,
  onTestToken,
  tokenInput,
}: TokenControlsProps) {
  const hasEnteredToken = tokenInput.trim().length > 0;
  const testTokenButtonLabel = hasEnteredToken
    ? "Test entered token"
    : "Test stored token";

  return (
    <section className="tool-panel">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 lg:text-lg dark:text-gray-100">
            Enter your Readwise access token
          </h2>
        </div>

        <label className="flex-1">
          <span className="tool-label">Access token</span>
          <input
            type="password"
            value={tokenInput}
            onChange={(event) => onSetTokenInput(event.target.value)}
            placeholder="Enter your Readwise access token"
            autoComplete="off"
            className="tool-field mt-1 w-full"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSaveToken}
            disabled={isSavingToken || !hasEnteredToken}
            className="tool-button"
          >
            {isSavingToken ? "Saving..." : "Save token"}
          </button>
          <button
            type="button"
            onClick={() => onTestToken(hasEnteredToken)}
            disabled={isTestingToken}
            className="tool-button-secondary"
          >
            {isTestingToken ? "Testing..." : testTokenButtonLabel}
          </button>
          <button
            type="button"
            onClick={onClearToken}
            disabled={isClearingToken || authStatus !== "authenticated"}
            className="tool-button-danger"
          >
            {isClearingToken ? "Clearing..." : "Clear token"}
          </button>
        </div>

        {authMessage && (
          <p
            className={`text-xs ${
              authMessage.tone === "success"
                ? "text-emerald-600"
                : authMessage.tone === "error"
                  ? "text-rose-600"
                  : "text-gray-600 dark:text-gray-300"
            }`}
          >
            {authMessage.text}
          </p>
        )}
      </div>
    </section>
  );
}
