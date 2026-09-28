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
