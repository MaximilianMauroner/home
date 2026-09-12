export type DrawerLayout = {
  mobile: boolean;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
};

/** Shared by the drawer CSS variables and MapLibre camera padding. */
export function drawerLayout(
  frame: { width: number; height: number },
  progress: number,
  expanded: boolean,
): DrawerLayout {
  const amount = Math.min(1, Math.max(0, progress));
  const mobile = frame.width <= 640;
  if (mobile) {
    const height = Math.round(frame.height * (expanded ? 0.72 : 0.52));
    return {
      mobile,
      width: frame.width,
      height,
      padding: { top: 0, right: 0, bottom: Math.round(height * amount), left: 0 },
    };
  }
  const width = Math.round(Math.min(expanded ? 928 : 640, frame.width * (expanded ? 0.7 : 0.4)));
  return {
    mobile,
    width,
    height: frame.height,
    padding: { top: 0, right: Math.round(width * amount), bottom: 0, left: 0 },
  };
}
