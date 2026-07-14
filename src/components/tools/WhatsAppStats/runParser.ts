import { parseChat, type ParsedChat, type ParseProgress } from "./parsing";
import type { ParserResponse } from "./parser.worker";

/**
 * Parse a chat export off the main thread via a web worker. Falls back to
 * synchronous parsing when workers are unavailable (e.g. SSR or older runtimes).
 */
export function runParser(
  text: string,
  onProgress?: (progress: ParseProgress) => void,
): Promise<ParsedChat> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(parseChat(text, onProgress));
  }

  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./parser.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // Fallback if the worker can't be constructed.
      resolve(parseChat(text, onProgress));
      return;
    }

    worker.onmessage = (event: MessageEvent<ParserResponse>) => {
      const data = event.data;
      if (data.type === "progress") {
        onProgress?.(data.progress);
        return;
      }

      worker.terminate();
      if (data.type === "success") resolve(data.result);
      else reject(new Error(data.error));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "Worker failed"));
    };
    worker.postMessage(text);
  });
}
