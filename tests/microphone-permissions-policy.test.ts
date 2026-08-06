import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

describe("microphone permissions policy", () => {
  test("allows microphone access only on the microphone tester route", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      headers: HeaderRule[];
    };
    const globalRule = config.headers.find((rule) => rule.source === "/(.*)");
    const microphoneRule = config.headers.find(
      (rule) => rule.source === "/tools/microphone-tester/:path*",
    );
    const policy = (rule: HeaderRule | undefined) =>
      rule?.headers.find((header) => header.key === "Permissions-Policy")
        ?.value;

    expect(policy(globalRule)).toContain("microphone=()");
    expect(policy(microphoneRule)).toContain("microphone=(self)");
    expect(config.headers.indexOf(microphoneRule!)).toBeGreaterThan(
      config.headers.indexOf(globalRule!),
    );
  });
});
