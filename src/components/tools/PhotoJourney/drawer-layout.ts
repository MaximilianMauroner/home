export type DrawerLayout = {
  mobile: boolean;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
};

/** A photo floats over the route, so opening it never moves the map camera. */
export function drawerLayout(
  frame: { width: number; height: number },
  expanded: boolean,
): DrawerLayout {
  const mobile = frame.width <= 640;
  if (mobile) {
    const height = Math.round(frame.height * (expanded ? 0.7 : 0.42));
    return {
      mobile,
      width: Math.max(0, frame.width - 24),
      height,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    };
  }
  const width = Math.round(Math.min(expanded ? 860 : 430, frame.width * (expanded ? 0.68 : 0.32)));
  const height = Math.round(Math.min(expanded ? frame.height - 32 : 480, frame.height * (expanded ? 0.9 : 0.62)));
  return {
    mobile,
    width,
    height,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}
