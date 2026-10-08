// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { ContentManager } from "@/components/tools/Stretching/components/ContentManager";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";

const stretch = (id: string): Stretch => ({
  id,
  name: `Stretch ${id}`,
  description: "Description",
  duration: 30,
  repetitions: 1,
  how: "How",
  lookFor: "Feel",
});

const routine: StretchRoutine = {
  id: "custom_test",
  name: "Test routine",
  goal: "Test goal",
  totalDuration: 60,
  stretches: [stretch("one"), stretch("two")],
};

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

describe("Routine Studio actions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onStartRoutine: Mock<(id: string, stretches: readonly Stretch[]) => void>;
  let onSaveRoutine: Mock<(routine: StretchRoutine) => void>;
  let onUpdateRoutine: Mock<
    (id: string, routine: Omit<StretchRoutine, "id">) => void
  >;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onStartRoutine =
      vi.fn<(id: string, stretches: readonly Stretch[]) => void>();
    onSaveRoutine = vi.fn<(routine: StretchRoutine) => void>();
    onUpdateRoutine =
      vi.fn<(id: string, routine: Omit<StretchRoutine, "id">) => void>();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    act(() => {
      root.render(
        createElement(ContentManager, {
          defaultRoutines: [],
          customRoutines: [routine],
          selectedRoutineId: routine.id,
          currentStretches: routine.stretches,
          onStartRoutine,
          onSaveRoutine,
          onUpdateRoutine,
          onDeleteRoutine: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function deleteStretch(id: string) {
    const actions = container.querySelector(
      `summary[aria-label="Actions for Stretch ${id}"]`,
    ) as HTMLElement;
    act(() => actions.click());
    const deleteButton = actions.parentElement?.querySelector(
      "button:last-child",
    ) as HTMLButtonElement;
    act(() => deleteButton.click());
  }

  it("saves the current draft after opening Edit routine", () => {
    deleteStretch("two");
    expect(container.textContent).toContain("1 stretches");

    act(() => button(container, "Edit routine").click());
    expect(
      container.querySelector('aside[aria-label="Routine summary"]')
        ?.textContent,
    ).toContain("1");
    act(() => button(container, "Save changes").click());

    expect(onUpdateRoutine).toHaveBeenCalledOnce();
    expect(onUpdateRoutine.mock.calls[0]?.[1].stretches).toHaveLength(1);
    expect(onUpdateRoutine.mock.calls[0]?.[1].stretches[0].id).toBe("one");
  });

  it.each([
    ["Edit routine", "Save changes"],
    ["New routine", "Create routine"],
  ])("protects unsaved metadata in %s", (entry, save) => {
    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Move Stretch one down"]',
        )!
        .click(),
    );
    act(() => button(container, entry).click());

    expect(
      container.querySelector('[aria-label="Close Routine Studio"]'),
    ).toBeNull();
    expect(container.querySelector('[aria-label="Routines"]')).toBeNull();
    expect(
      container.querySelector('summary[aria-label^="Actions for"]'),
    ).toBeNull();
    expect(
      [...container.querySelectorAll("button")].some((element) =>
        [
          "Add stretch",
          "New routine",
          "Edit routine",
          "Reset to saved stretches",
        ].includes(element.textContent?.trim() ?? ""),
      ),
    ).toBe(false);

    const name = container.querySelector<HTMLInputElement>("#routine-name")!;
    const goal = container.querySelector<HTMLTextAreaElement>("#routine-goal")!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(name, "Unsaved routine");
      name.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(goal, "Unsaved goal");
      goal.dispatchEvent(new Event("input", { bubbles: true }));
    });

    vi.mocked(window.confirm).mockReturnValue(false);
    for (const exit of [
      button(container, "Cancel"),
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Close routine form"]',
      )!,
    ]) {
      act(() => exit.click());
      expect(window.confirm).toHaveBeenLastCalledWith(
        "Discard your unsaved routine changes?",
      );
      expect(name.value).toBe("Unsaved routine");
      expect(goal.value).toBe("Unsaved goal");
      expect(container.contains(name)).toBe(true);
    }

    act(() => button(container, save).click());
    const saved =
      entry === "Edit routine"
        ? onUpdateRoutine.mock.calls[0]?.[1]
        : onSaveRoutine.mock.calls[0]?.[0];
    expect(saved?.name).toBe("Unsaved routine");
    expect(saved?.goal).toBe("Unsaved goal");
    expect(saved?.stretches.map(({ id }) => id)).toEqual(["two", "one"]);
    expect(container.querySelector("#routine-name")).toBeNull();
    expect(button(container, "Add stretch")).toBeDefined();
  });

  it("returns from metadata Cancel with the working sequence intact", () => {
    deleteStretch("two");
    act(() => button(container, "Edit routine").click());
    act(() => button(container, "Cancel").click());

    expect(container.querySelector("#routine-name")).toBeNull();
    act(() => button(container, "Edit routine").click());
    act(() => button(container, "Save changes").click());
    expect(
      onUpdateRoutine.mock.calls[0]?.[1].stretches.map(({ id }) => id),
    ).toEqual(["one"]);
  });

  it("blocks Start, Create, and Save for an empty draft", () => {
    deleteStretch("one");
    deleteStretch("two");

    expect(button(container, "Start routine").disabled).toBe(true);
    act(() => button(container, "New routine").click());
    expect(button(container, "Create routine").disabled).toBe(true);
    act(() => button(container, "Cancel").click());
    act(() => button(container, "Edit routine").click());
    expect(button(container, "Save changes").disabled).toBe(true);
    expect(onStartRoutine).not.toHaveBeenCalled();
    expect(onSaveRoutine).not.toHaveBeenCalled();
    expect(onUpdateRoutine).not.toHaveBeenCalled();
  });

  it("keeps a reordered draft when closing is cancelled", () => {
    const down = container.querySelector<HTMLButtonElement>(
      '[aria-label="Move Stretch one down"]',
    )!;
    act(() => down.click());
    expect(
      container.querySelector("ol")?.textContent?.indexOf("Stretch two"),
    ).toBeLessThan(
      container.querySelector("ol")?.textContent?.indexOf("Stretch one") ?? 0,
    );
    vi.mocked(window.confirm).mockReturnValue(false);
    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Close Routine Studio"]',
        )!
        .click(),
    );
    expect(window.confirm).toHaveBeenCalledWith(
      "Discard your unsaved Studio changes?",
    );
    act(() => button(container, "Edit routine").click());
    act(() => button(container, "Save changes").click());
    expect(
      onUpdateRoutine.mock.calls[0]?.[1].stretches.map(({ id }) => id),
    ).toEqual(["two", "one"]);
  });

  it("opens an empty saved routine in Studio so it can be repaired", () => {
    const emptyRoutine = { ...routine, totalDuration: 0, stretches: [] };
    act(() => {
      root.render(
        createElement(ContentManager, {
          key: "empty",
          defaultRoutines: [],
          customRoutines: [emptyRoutine],
          selectedRoutineId: emptyRoutine.id,
          currentStretches: [],
          initialRoutineIntent: {
            mode: "edit",
            routineId: emptyRoutine.id,
          },
          onStartRoutine,
          onSaveRoutine,
          onUpdateRoutine,
          onDeleteRoutine: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    expect(button(container, "Start routine").disabled).toBe(true);
    expect(button(container, "Add stretch")).toBeDefined();
    expect(container.textContent).not.toContain("Save changes");
    act(() => button(container, "Add stretch").click());
    expect(container.textContent).toContain("Add stretch");
  });
});
