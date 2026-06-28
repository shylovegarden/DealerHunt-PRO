import { describe, it, expect } from "vitest";
import { assess, chameleonHarvest } from "./chameleon";

describe("assess — the verdict + next move", () => {
  it("wins when vehicles were extracted", () => {
    const v = assess({
      blocked: false,
      unverified: false,
      wall: "cloudflare",
      dataStrategy: "ld-json",
      count: 64,
      tier: "stealth",
    });
    expect(v.ok).toBe(true);
    expect(v.diagnosis).toContain("64 vehicles");
    expect(v.diagnosis).toContain("beat cloudflare");
    expect(v.recommendation).toBeUndefined();
  });

  it("DataDome → route via aggregator", () => {
    const v = assess({
      blocked: true,
      unverified: false,
      wall: "datadome",
      dataStrategy: "html",
      count: 0,
      tier: "headed",
    });
    expect(v.ok).toBe(false);
    expect(v.recommendation).toMatch(/aggregator/i);
  });

  it("empty SPA shell → capture the XHR API", () => {
    const v = assess({
      blocked: false,
      unverified: true,
      wall: "none",
      dataStrategy: "spa-api",
      count: 0,
      tier: "static",
    });
    expect(v.ok).toBe(false);
    expect(v.recommendation).toMatch(/XHR|endpoint|capture/i);
  });

  it("server HTML with no island → bespoke parser", () => {
    const v = assess({
      blocked: false,
      unverified: true,
      wall: "none",
      dataStrategy: "html",
      count: 0,
      tier: "static",
    });
    expect(v.ok).toBe(false);
    expect(v.recommendation).toMatch(/bespoke parser|selectors/i);
  });
});

describe("chameleonHarvest — full orchestration (injected fetcher)", () => {
  const jsonLdPage = `<html><script type="application/ld+json">${JSON.stringify(
    {
      "@type": "Vehicle",
      name: "2018 Toyota Tacoma",
      brand: "Toyota",
      offers: { price: 28000 },
    },
  )}</script></html>`;

  it("fetches, extracts, and reports OK on a JSON-LD site", async () => {
    const report = await chameleonHarvest("https://dealer.example/inventory", {
      source: "example",
      fetchImpl: async () => ({
        html: jsonLdPage,
        tier: "static",
        blocked: false,
      }),
    });
    expect(report.ok).toBe(true);
    expect(report.count).toBe(1);
    expect(report.deals[0].make).toBe("Toyota");
    expect(report.dataStrategy).toBe("ld-json");
    expect(report.diagnosis).toContain("1 vehicle");
  });

  it("reports a blocked DataDome wall with a routing recommendation", async () => {
    const report = await chameleonHarvest("https://walled.example/cars", {
      fetchImpl: async () => ({
        html: "captcha geo.captcha-delivery.com datadome",
        tier: "headed",
        blocked: true,
      }),
    });
    expect(report.ok).toBe(false);
    expect(report.wall).toBe("datadome");
    expect(report.recommendation).toMatch(/aggregator/i);
  });

  it("prefers a bespoke extractor, self-heals to generic when it returns nothing", async () => {
    const report = await chameleonHarvest("https://dealer.example/x", {
      extractor: () => [], // bespoke parser whiffs (markup drift)
      fetchImpl: async () => ({
        html: jsonLdPage,
        tier: "static",
        blocked: false,
      }),
    });
    expect(report.ok).toBe(true); // generic extractor backstopped it
    expect(report.count).toBe(1);
  });
});
