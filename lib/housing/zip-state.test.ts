import { describe, it, expect } from "vitest";
import { zipToState, resolveSearchScope } from "./zip-state";

describe("zipToState", () => {
  it("maps ZIPs to the right state via USPS prefixes", () => {
    expect(zipToState("10001")).toBe("NY"); // Manhattan
    expect(zipToState("30303")).toBe("GA"); // Atlanta
    expect(zipToState("90011")).toBe("CA"); // LA
    expect(zipToState("60616")).toBe("IL"); // Chicago
    expect(zipToState("48201")).toBe("MI"); // Detroit
    expect(zipToState("77494")).toBe("TX"); // Katy
    expect(zipToState("99501")).toBe("AK");
    expect(zipToState("96813")).toBe("HI");
  });
  it("returns null for non-ZIPs", () => {
    expect(zipToState("abcde")).toBeNull();
    expect(zipToState("1")).toBeNull();
  });
});

describe("resolveSearchScope", () => {
  it("a ZIP scopes to its state and filters by the ZIP", () => {
    const r = resolveSearchScope("30303");
    expect(r.state).toBe("GA");
    expect(r.q).toBe("30303");
  });
  it("a trailing state code scopes to that state", () => {
    expect(resolveSearchScope("Cleveland, OH").state).toBe("OH");
    expect(resolveSearchScope("austin tx").state).toBe("TX");
  });
  it("a full state name scopes to it", () => {
    expect(resolveSearchScope("Michigan").state).toBe("MI");
  });
  it("a plain city goes nationwide with the text as a filter", () => {
    const r = resolveSearchScope("Cleveland");
    expect(r.state).toBeNull();
    expect(r.q).toBe("Cleveland");
  });
  it("empty → nationwide", () => {
    expect(resolveSearchScope("  ").state).toBeNull();
  });
});
