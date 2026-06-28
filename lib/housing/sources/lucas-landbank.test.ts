import { describe, it, expect } from "vitest";
import { parseLucasLandBank } from "./lucas-landbank";

// Fixture mirrors the Framer SSR structure of lucascountylandbank.org/properties: a status badge + a
// neighborhood render before each "Address Price" block, which holds the street (h3) and a $ price. The
// real page renders each card 3× (responsive variants) — the parser must dedupe to unique streets.
const card = (status: string, nbhd: string, street: string, price: string) => `
<div><p>${status}</p></div><div><p>${nbhd}</p></div>
<div data-framer-name="Address Price">
  <div data-framer-name="Address"><div data-framer-component-type="RichTextContainer"><h3 class="framer-text">${street}</h3></div></div>
  <div data-framer-name="Price"><p>${price}</p></div>
</div>`;

const FIXTURE = `<html><body>
${card("Move-In Ready", "West Toledo", "1489 Amesbury", "")}
${card("Move-In Ready", "West Toledo", "1489 Amesbury", "")}
${card("Needs Renovation", "North Toledo", "3056 Chase", "$25,000")}
${card("Vacant Lot", "South Toledo", "901 Toronto", "$5,000")}
</body></html>`;

describe("parseLucasLandBank", () => {
  const rows = parseLucasLandBank(FIXTURE);

  it("dedupes responsive duplicate cards to unique streets", () => {
    expect(rows).toHaveLength(3); // Amesbury appears twice → one row
    expect(rows.map((r) => r.address)).toEqual([
      "1489 Amesbury",
      "3056 Chase",
      "901 Toronto",
    ]);
  });

  it("maps a Toledo house with price + status + neighborhood", () => {
    const p = rows[1];
    expect(p.source).toBe("land_bank");
    expect(p.source_listing_id).toBe("lclb-3056-chase");
    expect(p.city).toBe("Toledo");
    expect(p.state).toBe("OH");
    expect(p.price).toBe(25000);
    expect(p.property_type).toBe("single_family");
    expect(p.description).toBe("Needs Renovation");
    expect(p.signals?.neighborhood).toBe("North Toledo");
    expect(p.seller).toBe("Lucas County Land Bank");
  });

  it("classifies a vacant lot as land", () => {
    expect(rows[2].property_type).toBe("land");
    expect(rows[2].price).toBe(5000);
  });

  it("handles a missing price (Move-In Ready without a listed $)", () => {
    expect(rows[0].price).toBeUndefined();
    expect(rows[0].description).toBe("Move-In Ready");
  });

  it("is vertical-isolated — Property fields only, no vehicle fields", () => {
    for (const p of rows) {
      expect(p).not.toHaveProperty("make");
      expect(p).not.toHaveProperty("year");
      expect(p.address).toBeTruthy();
    }
  });
});
