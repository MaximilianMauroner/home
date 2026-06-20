import { parseChat, type ParsedChat } from "./parsing";

export type ParserResponse =
  | { ok: true; result: ParsedChat }
  | { ok: false; error: string };

self.onmessage = (event: MessageEvent<string>) => {
  try {
    const result = parseChat(event.data);
    (self as unknown as Worker).postMessage({
      ok: true,
      result,
    } satisfies ParserResponse);
  } catch (error) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies ParserResponse);
  }
};
