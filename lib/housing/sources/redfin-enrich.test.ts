import { describe, it, expect } from "vitest";
import { parseRedfinDetail, enrichRedfinProperties } from "./redfin-enrich";
import type { Property } from "../types";

// Mirrors the real Redfin listing DOM markers verified live (headed Patchright): the listingRemarks
// section, the "Presented by" agent line, and bigphoto CDN URLs (plus thumbnails that must be ignored).
const HTML = `
<div class="remarksContainer"><span class="marketingRemarks" id="marketingRemarks-preview" data-rf-test-id="listingRemarks"><div class="sectionContentContainer" style="max-height:120px"><div class="sectionContent"><div>Investor special — sold strictly as-is, cash only. Needs full rehab/TLC but priced to move.</div></div></div></span><button>Show more</button></div>
<div class="agentInfoItem"><span class="listingAgentAndBrokerLogo">Presented by Jane Investor | Acme Realty</span></div>
<img src="https://ssl.cdn-redfin.com/photo/641/bigphoto/057/2138553905585786057_0.jpg"/>
<img src="https://ssl.cdn-redfin.com/photo/641/mbphotov3/057/genMid.2138553905585786057_7_0.jpg"/>
<img src="https://ssl.cdn-redfin.com/photo/641/bigphoto/057/2138553905585786057_1.jpg"/>
`;

describe("parseRedfinDetail", () => {
  it("extracts the marketing remarks (trimming trailing UI chrome)", () => {
    const d = parseRedfinDetail(HTML);
    expect(d.description!.startsWith("Investor special")).toBe(true); // no leading marker artifact
    expect(d.description).toContain("as-is");
    expect(d.description).not.toMatch(/Show more/i);
    expect(d.description).not.toMatch(/listingRemarks|data-rf/i);
  });

  it("extracts the listing agent name", () => {
    expect(parseRedfinDetail(HTML).agent).toBe("Jane Investor");
  });

  it("keeps only full-size bigphoto images (drops thumbnails), deduped", () => {
    const imgs = parseRedfinDetail(HTML).images!;
    expect(imgs).toHaveLength(2);
    expect(imgs.every((u) => u.includes("bigphoto"))).toBe(true);
  });

  it("returns empty object on a page without a remarks block", () => {
    expect(parseRedfinDetail("<html>no listing here</html>")).toEqual({});
  });
});

describe("enrichRedfinProperties (gating)", () => {
  const base: Property = {
    source: "redfin",
    source_url: "https://www.redfin.com/x/home/1",
    title: "x",
    signals: { mls: true },
  };

  it("respects REDFIN_ENRICH_MAX=0 (no-op, returns input untouched)", async () => {
    const props = [base];
    const out = await enrichRedfinProperties(props, { max: 0 });
    expect(out).toBe(props);
  });

  it("only targets Redfin listings missing a description (never re-enriches)", async () => {
    // All candidates already have a description or aren't Redfin → nothing to enrich, returns same array.
    const props: Property[] = [
      { ...base, description: "already has remarks" },
      { source: "hud", title: "h", source_url: "u" },
    ];
    const out = await enrichRedfinProperties(props, { max: 10 });
    expect(out).toEqual(props);
  });
});
