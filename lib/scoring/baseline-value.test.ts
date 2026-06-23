import { describe, it, expect } from "vitest";
import { estimateBaselineValue, classifySegment } from "./baseline-value";

describe("classifySegment", () => {
  it("classifies common models", () => {
    expect(classifySegment("Ford", "Mustang")).toBe("sports");
    expect(classifySegment("Toyota", "Sequoia")).toBe("fullsize_suv");
    expect(classifySegment("Ford", "F-150")).toBe("fullsize_truck");
    expect(classifySegment("Toyota", "Tacoma")).toBe("midsize_truck");
    expect(classifySegment("Honda", "Civic")).toBe("sedan");
    expect(classifySegment("BMW", "M5")).toBe("luxury");
  });
});

describe("estimateBaselineValue", () => {
  it("gives realistic resale, not inflated", () => {
    // A 2010 base Mustang should be a few thousand, NOT $42k.
    const mustang = estimateBaselineValue(2010, "Ford", "Mustang", 89000);
    expect(mustang).toBeGreaterThan(3000);
    expect(mustang).toBeLessThan(15000);

    // A high-mileage 2008 Sequoia should be modest.
    const sequoia = estimateBaselineValue(2008, "Toyota", "Sequoia", 313000);
    expect(sequoia).toBeGreaterThan(1200);
    expect(sequoia).toBeLessThan(12000);
  });

  it("newer holds more value than older", () => {
    const newer = estimateBaselineValue(2022, "Ford", "F-150", 30000);
    const older = estimateBaselineValue(2008, "Ford", "F-150", 180000);
    expect(newer).toBeGreaterThan(older);
  });

  it("high mileage reduces value", () => {
    const low = estimateBaselineValue(2018, "Toyota", "Camry", 40000);
    const high = estimateBaselineValue(2018, "Toyota", "Camry", 180000);
    expect(low).toBeGreaterThan(high);
  });

  it("returns 0 for missing/invalid year", () => {
    expect(estimateBaselineValue(null, "Ford", "F-150")).toBe(0);
  });
});
