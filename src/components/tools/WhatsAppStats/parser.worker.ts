import { parseChat, type ParsedChat, type ParseProgress } from "./parsing";

export type ParserResponse =
  | { type: "progress"; progress: ParseProgress }
  | { type: "success"; result: ParsedChat }
  | { type: "error"; error: string };

self.onmessage = (event: MessageEvent<string>) => {
  try {
    const result = parseChat(event.data, (progress) => {
      (self as unknown as Worker).postMessage({
        type: "progress",
        progress,
      } satisfies ParserResponse);
    });
    (self as unknown as Worker).postMessage({
      type: "success",
      result,
    } satisfies ParserResponse);
  } catch (error) {
    (self as unknown as Worker).postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    } satisfies ParserResponse);
  }
};
