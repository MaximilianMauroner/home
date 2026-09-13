import { describe, expect, test } from "vitest";
import { drawerLayout } from "../src/components/tools/PhotoJourney/drawer-layout";

describe("Photo Journey drawer layout", () => {
  test("floats a compact desktop photo without moving the map camera", () => {
    const open = drawerLayout({ width: 1200, height: 700 }, false);
    const expanded = drawerLayout({ width: 1200, height: 700 }, true);
    expect(open.width).toBe(504);
    expect(open.height).toBe(504);
    expect(open.padding.right).toBe(0);
    expect(expanded.padding.right).toBe(0);
    expect(expanded.width).toBeGreaterThan(open.width);
  });

  test("keeps the route visible behind a compact mobile photo", () => {
    const open = drawerLayout({ width: 360, height: 800 }, false);
    const expanded = drawerLayout({ width: 360, height: 800 }, true);
    expect(open).toMatchObject({ mobile: true, width: 336, height: 336 });
    expect(open.padding.bottom).toBe(0);
    expect(expanded.height).toBe(560);
    expect(expanded.padding.bottom).toBe(0);
  });
});
