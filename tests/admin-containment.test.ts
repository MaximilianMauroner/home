import type { APIRoute } from "astro";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("astro:content", () => ({
  getCollection: vi.fn(() => {
    throw new Error("The endpoint accessed content before blocking");
  }),
}));

import { DELETE as deleteContent } from "../src/pages/api/admin/delete";
import { GET as getContent } from "../src/pages/api/admin/get";
import { GET as listContent } from "../src/pages/api/admin/list";
import { POST as saveContent } from "../src/pages/api/admin/save";
import { POST as uploadContent } from "../src/pages/api/admin/upload";

const endpoints: Array<{ handler: APIRoute; name: string }> = [
  { handler: getContent, name: "get" },
  { handler: listContent, name: "list" },
  { handler: saveContent, name: "save" },
  { handler: deleteContent, name: "delete" },
  { handler: uploadContent, name: "upload" },
];

function inaccessibleContext(): Parameters<APIRoute>[0] {
  return new Proxy({} as Parameters<APIRoute>[0], {
    get() {
      throw new Error("The endpoint accessed request context before blocking");
    },
  });
}

beforeEach(() => {
  vi.stubEnv("PROD", true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production admin API containment", () => {
  for (const { handler, name } of endpoints) {
    test(`${name} rejects anonymous access before reading the request`, async () => {
      const response = await handler(inaccessibleContext());

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "Not Found" });
    });
  }
});
