import { describe, it, expect } from "vitest";
import { zipOfRegion } from "./redfin-zip-ppsf";

describe("zipOfRegion", () => {
  it("pulls a 5-digit zip out of Redfin's REGION cell", () => {
    expect(zipOfRegion("Zip Code: 60616")).toBe("60616");
    expect(zipOfRegion('"Zip Code: 30303"')).toBe("30303");
  });
  it("returns null when no zip is present", () => {
    expect(zipOfRegion("Zip Code: ")).toBeNull();
    expect(zipOfRegion("National")).toBeNull();
  });
});
