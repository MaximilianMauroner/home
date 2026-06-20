import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Human-readable tool name, shown in the fallback message. */
  name?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a heavy tool island so an uncaught throw
 * shows a recoverable message instead of blanking the whole tool.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[tool error]", this.props.name ?? "", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="tool-panel-lg mx-auto flex max-w-xl flex-col items-start gap-3 text-card-foreground"
        >
          <h2 className="text-lg font-semibold text-foreground">
            {this.props.name ?? "This tool"} hit an error
          </h2>
          <p className="text-sm text-muted-foreground">
            Something went wrong while running this tool. Your data stays in the
            browser — try reloading, and if it keeps happening the input may be
            unsupported.
          </p>
          <pre className="max-w-full overflow-auto rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="tool-button"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
