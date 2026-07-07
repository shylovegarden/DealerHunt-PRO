import { describe, it, expect } from "vitest";
import { STATE_BBOX } from "./active-states";
import { statesToAreas } from "./sources/redfin-gis";

describe("demand-driven harvest scope", () => {
  it("STATE_BBOX covers all 50 states + DC", () => {
    expect(Object.keys(STATE_BBOX)).toHaveLength(51);
    for (const [code, b] of Object.entries(STATE_BBOX)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(b.west).toBeLessThan(b.east);
      expect(b.south).toBeLessThan(b.north);
    }
  });

  it("statesToAreas builds one bbox area per known state, skips unknown", () => {
    const areas = statesToAreas(["MO", "IL", "ZZ"], STATE_BBOX);
    expect(areas).toHaveLength(2);
    for (const a of areas) {
      expect(a.bbox).toBeDefined();
      // center sits inside its own bbox
      expect(a.lat).toBeGreaterThan(a.bbox!.south);
      expect(a.lat).toBeLessThan(a.bbox!.north);
      expect(a.lng).toBeGreaterThan(a.bbox!.west);
      expect(a.lng).toBeLessThan(a.bbox!.east);
    }
    expect(areas.map((a) => a.name)).toEqual(["MO", "IL"]);
  });
});
