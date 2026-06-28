import { describe, it, expect } from "vitest";
import { parsePublicSurplusProperties } from "./publicsurplus-property";

// Mirrors the PublicSurplus card markup (anchor + title, price <b>, state badge).
const HTML = `
<a href="/sms/auction/view?auc=4028169" title="#4028169 - 2006 3 bed 2 bath mobile home in need of repair">link</a>
<b id="val_4028169catGrid"> $4,500.00 </b>
<div>...<span class="auction-item-state"> MN </span></div>
<a href="/sms/auction/view?auc=3980808" title="#3980808 - Stearns County Tax Forfeited Land - 06.03829">link</a>
<b id="val_3980808catGrid"> $12,000 </b>
<div><span class="auction-item-state"> MN </span></div>
`;

describe("parsePublicSurplusProperties", () => {
  const props = parsePublicSurplusProperties(HTML);

  it("parses real-estate auction cards into Properties", () => {
    expect(props.length).toBe(2);
    const home = props.find((p) => p.source_listing_id === "psre-4028169")!;
    expect(home.source).toBe("gov_auction");
    expect(home.property_type).toBe("mobile");
    expect(home.price).toBe(4500);
    expect(home.beds).toBe(3);
    expect(home.baths).toBe(2);
    expect(home.state).toBe("MN");
    expect(home.seller_type).toBe("gov");
  });

  it("classifies tax-forfeited land", () => {
    const land = props.find((p) => p.source_listing_id === "psre-3980808")!;
    expect(land.property_type).toBe("land");
    expect(land.price).toBe(12000);
  });

  it("skips cards with no live bid", () => {
    expect(
      parsePublicSurplusProperties(
        `<a href="/sms/auction/view?auc=99" title="#99 - some lot">x</a>`,
      ),
    ).toEqual([]);
  });
});
