import { describe, it, expect } from "vitest";
import { readHomeCondition } from "./condition";

describe("readHomeCondition", () => {
  it("treats land as vacant land regardless of text", () => {
    expect(readHomeCondition({ property_type: "land" })).toEqual({
      label: "Vacant land",
      tier: "caution",
    });
  });

  it("detects vacant lots from status/title even without the land type", () => {
    expect(
      readHomeCondition({ status: "Vacant Land - Available" })!.label,
    ).toBe("Vacant land");
  });

  it("flags renovation/distress as risk", () => {
    for (const s of [
      "Needs Renovation",
      "handyman special",
      "sold as-is",
      "fire damage",
    ]) {
      expect(readHomeCondition({ status: s })!).toMatchObject({
        label: "Needs renovation",
        tier: "risk",
      });
    }
  });

  it("flags move-in ready as good", () => {
    expect(
      readHomeCondition({ title: "Beautifully renovated, move-in ready" })!,
    ).toMatchObject({ label: "Move-in ready", tier: "good" });
  });

  it("marks pending/under-contract as info", () => {
    expect(readHomeCondition({ status: "Pending Sale" })!.tier).toBe("info");
  });

  it("returns null when there's nothing to say", () => {
    expect(readHomeCondition({ property_type: "single_family" })).toBeNull();
    expect(readHomeCondition({ status: "New Listing" })).toBeNull();
  });
});
