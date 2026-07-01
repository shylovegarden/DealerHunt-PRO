import { describe, it, expect } from "vitest";
import { classifyFloodZone } from "./fema-flood";

describe("classifyFloodZone", () => {
  it("flags Special Flood Hazard Areas (A*/V*) as high risk", () => {
    for (const z of ["A", "AE", "AH", "AO", "AR", "A99", "V", "VE"]) {
      const r = classifyFloodZone(z)!;
      expect(r.high).toBe(true);
      expect(r.label).toMatch(/mandatory flood insurance/);
    }
  });

  it("treats X / minimal zones as low risk", () => {
    const r = classifyFloodZone("X")!;
    expect(r.high).toBe(false);
    expect(r.zone).toBe("X");
    expect(r.label).toMatch(/minimal risk/);
  });

  it("returns null for an empty/unknown zone (never guesses)", () => {
    expect(classifyFloodZone("")).toBeNull();
    expect(classifyFloodZone(null)).toBeNull();
    expect(classifyFloodZone(undefined)).toBeNull();
  });
});
