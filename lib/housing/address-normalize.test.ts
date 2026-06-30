import { describe, it, expect } from "vitest";
import { normalizeAddress } from "./address-normalize";

describe("normalizeAddress", () => {
  it("collapses street-type + casing + punctuation variants to one key", () => {
    const a = normalizeAddress(
      "123 Main Street",
      "Philadelphia",
      "PA",
      "19104",
    );
    const b = normalizeAddress(
      "123 MAIN ST.",
      "philadelphia",
      "pa",
      "19104-1234",
    );
    expect(a).toBe(b);
    expect(a).toBe("123 main st|19104");
  });

  it("normalizes directionals", () => {
    expect(
      normalizeAddress("8419 North Loretto Ave", null, null, "19111"),
    ).toBe(normalizeAddress("8419 N Loretto Avenue", null, null, "19111"));
  });

  it("drops unit/apt designators so a building keys together", () => {
    expect(
      normalizeAddress("500 Oak Rd Apt 4B", "Chicago", "IL", "60601"),
    ).toBe(normalizeAddress("500 Oak Rd", "Chicago", "IL", "60601"));
  });

  it("falls back to city+state when no zip", () => {
    expect(normalizeAddress("10 Elm St", "Norfolk", "VA")).toBe(
      "10 elm st|norfolk va",
    );
  });

  it("returns null without enough to dedupe on", () => {
    expect(normalizeAddress("", "X", "Y")).toBeNull();
    expect(normalizeAddress("10 Elm St")).toBeNull();
  });
});
