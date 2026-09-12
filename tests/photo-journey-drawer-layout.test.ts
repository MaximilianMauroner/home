import { describe, expect, test } from "vitest";
import { drawerLayout } from "../src/components/tools/PhotoJourney/drawer-layout";

describe("Photo Journey drawer layout", () => {
  test("uses the same desktop extent for the drawer and camera padding", () => {
    const closed = drawerLayout({ width: 1200, height: 700 }, 0, false);
    const open = drawerLayout({ width: 1200, height: 700 }, 1, false);
    const expanded = drawerLayout({ width: 1200, height: 700 }, 1, true);
    expect(open.width).toBe(480);
    expect(open.padding.right).toBe(open.width);
    expect(closed.padding.right).toBe(0);
    expect(expanded.padding.right).toBe(expanded.width);
    expect(expanded.width).toBeGreaterThan(open.width);
  });

  test("keeps roughly half the mobile stage and clears padding when closed", () => {
    const open = drawerLayout({ width: 360, height: 800 }, 1, false);
    const expanded = drawerLayout({ width: 360, height: 800 }, 1, true);
    expect(open).toMatchObject({ mobile: true, width: 360, height: 416 });
    expect(open.padding.bottom).toBe(open.height);
    expect(expanded.height).toBe(576);
    expect(drawerLayout({ width: 360, height: 800 }, 0, true).padding.bottom).toBe(0);
  });
});
