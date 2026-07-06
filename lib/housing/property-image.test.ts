import { describe, it, expect } from "vitest";
import { aerialThumb, resolvePropertyImage } from "./property-image";

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
    expect(url).toContain("size=640,480");
  });
});

describe("resolvePropertyImage (photo fallback chain)", () => {
  it("prefers a real listing photo", () => {
    const r = resolvePropertyImage({
      image: "https://x.com/photo.jpg",
      lat: 42.36,
      lng: -71.05,
    });
    expect(r).toEqual({ url: "https://x.com/photo.jpg", kind: "listing" });
  });

  it("falls back to an aerial when there is no photo but coords exist", () => {
    const r = resolvePropertyImage({ lat: 42.36, lng: -71.05 });
    expect(r?.kind).toBe("aerial");
    expect(r?.url).toContain("World_Imagery");
  });

  it("returns null when there is neither a photo nor usable coords", () => {
    expect(resolvePropertyImage({ image: null, lat: 0, lng: 0 })).toBeNull();
    expect(resolvePropertyImage({})).toBeNull();
  });
});
