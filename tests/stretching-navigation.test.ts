import { describe, expect, test } from "vitest";

import {
  parseStretchingNavigation,
  serializeStretchingNavigation,
} from "../src/components/tools/Stretching/navigation";
import {
  parseStoredCustomRoutines,
  parseStoredRestDuration,
  parseStoredStretches,
} from "../src/components/tools/Stretching/persistence";
import {
  CUSTOM_ROUTINES_KEY,
  ROUTINE_SELECTOR_KEY,
  STORAGE_KEY,
  TIME_BETWEEN_KEY,
} from "../src/components/tools/Stretching/constants";

const routineIds = new Set(["routine_1", "custom_evening"]);

describe("stretching navigation", () => {
  test.each(["quickstart", "browser", "active", "content-manager"] as const)(
    "parses the %s view without carrying a routine ID",
    (view) => {
      expect(
        parseStretchingNavigation(
          `?view=${view}&routine=routine_1`,
          routineIds,
        ),
      ).toEqual({ view, routineId: null });
    },
  );

  test("falls back to quickstart for absent and invalid views", () => {
    expect(parseStretchingNavigation("", routineIds)).toEqual({
      view: "quickstart",
      routineId: null,
    });
    expect(
      parseStretchingNavigation(
        "?view=unsupported&routine=routine_1",
        routineIds,
      ),
    ).toEqual({ view: "quickstart", routineId: null });
  });

  test("accepts preview only when its routine is available", () => {
    expect(
      parseStretchingNavigation(
        "?view=preview&routine=custom_evening",
        routineIds,
      ),
    ).toEqual({ view: "preview", routineId: "custom_evening" });

    expect(
      parseStretchingNavigation("?view=preview&routine=missing", routineIds),
    ).toEqual({ view: "browser", routineId: null });
    expect(parseStretchingNavigation("?view=preview", routineIds)).toEqual({
      view: "browser",
      routineId: null,
    });
  });

  test("serializes canonical query states while preserving unrelated params", () => {
    expect(
      serializeStretchingNavigation("?source=home&view=browser", {
        view: "preview",
        routineId: "routine_1",
      }),
    ).toBe("?source=home&view=preview&routine=routine_1");

    expect(
      serializeStretchingNavigation("?source=home&view=preview&routine=old", {
        view: "active",
        routineId: null,
      }),
    ).toBe("?source=home&view=active");

    expect(
      serializeStretchingNavigation("?view=preview&routine=old", {
        view: "quickstart",
        routineId: null,
      }),
    ).toBe("");
  });
});

describe("stretching persistence parsing", () => {
  test("retains the existing storage key contract", () => {
    expect(STORAGE_KEY).toBe("stretching-app-stretches");
    expect(ROUTINE_SELECTOR_KEY).toBe("stretching-app-routine-selector");
    expect(TIME_BETWEEN_KEY).toBe("stretching-app-time-between");
    expect(CUSTOM_ROUTINES_KEY).toBe("stretching-app-custom-routines");
  });

  test("invalid stored JSON falls back without throwing", () => {
    expect(parseStoredStretches("{")).toBeNull();
    expect(parseStoredCustomRoutines("not-json")).toEqual([]);
    expect(parseStoredRestDuration("NaN")).toBe(10);
  });
});
