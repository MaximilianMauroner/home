export const STRETCHING_VIEWS = [
  "quickstart",
  "browser",
  "preview",
  "active",
  "content-manager",
] as const;

export type StretchingView = (typeof STRETCHING_VIEWS)[number];

export interface StretchingNavigationState {
  view: StretchingView;
  routineId: string | null;
}

const DEFAULT_NAVIGATION: StretchingNavigationState = {
  view: "quickstart",
  routineId: null,
};

function isStretchingView(value: string | null): value is StretchingView {
  return STRETCHING_VIEWS.some((view) => view === value);
}

export function parseStretchingNavigation(
  search: string,
  availableRoutineIds: ReadonlySet<string>,
): StretchingNavigationState {
  const params = new URLSearchParams(search);
  const view = params.get("view");

  if (!isStretchingView(view)) return DEFAULT_NAVIGATION;

  if (view === "preview") {
    const routineId = params.get("routine");
    return routineId && availableRoutineIds.has(routineId)
      ? { view, routineId }
      : { view: "browser", routineId: null };
  }

  return { view, routineId: null };
}

export function serializeStretchingNavigation(
  search: string,
  navigation: StretchingNavigationState,
): string {
  const params = new URLSearchParams(search);

  if (navigation.view === "quickstart") {
    params.delete("view");
    params.delete("routine");
  } else {
    params.set("view", navigation.view);
    if (navigation.view === "preview" && navigation.routineId) {
      params.set("routine", navigation.routineId);
    } else {
      params.delete("routine");
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
