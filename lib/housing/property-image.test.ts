import { describe, it, expect } from "vitest";
import { aerialThumb } from "./property-image";

describe("aerialThumb", () => {
  it("should return null for invalid inputs", () => {
    expect(aerialThumb()).toBeNull();
    expect(aerialThumb(null, null)).toBeNull();
    expect(aerialThumb(0, 0)).toBeNull();
    expect(aerialThumb(NaN, NaN)).toBeNull();
  });

  it("should return correct Esri World Imagery URL for valid coordinates", () => {
    const lat = 42.3601;
    const lng = -71.0589;
    const url = aerialThumb(lat, lng);
    expect(url).not.toBeNull();
    expect(url).toContain("bbox=-71.060");
    expect(url).toContain("42.3586");
    expect(url).toContain("size=400,300");
  });
});
