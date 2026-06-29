import { describe, it, expect } from "vitest";
import { parseTaxDelinquent } from "./tax-delinquent";
import { scoreHousingLead } from "../lead-score";

const ROWS = [
  {
    opa_number: 41040500,
    street_address: "5540 PEARL ST",
    zip_code: 19139,
    owner: "PRESSLEY DUANE",
    total_due: 4041.05,
    num_years_owed: 7,
    oldest_year_owed: 2017,
    total_assessment: 88000,
    building_category: "Single Family",
    is_actionable: "true",
    payment_agreement: "false",
    sheriff_sale: "false",
    bankruptcy: "false",
    mailing_address: "5540 PEARL ST", // owner-occupied
    mailing_state: "PA",
  },
  {
    opa_number: 999,
    street_address: "100 MARKET ST",
    zip_code: 19107,
    owner: "OUT OF TOWN LLC",
    total_due: 25000,
    num_years_owed: 4,
    total_assessment: 200000,
    building_category: "Vacant Land",
    is_actionable: "true",
    payment_agreement: "false",
    sheriff_sale: "true",
    mailing_address: "1 WALL ST",
    mailing_state: "NY", // out-of-state absentee
  },
  {
    opa_number: 5,
    street_address: "1 PAID ST",
    total_due: 9000,
    num_years_owed: 3,
    is_actionable: "true",
    payment_agreement: "true", // already arranged → dropped
  },
];

describe("parseTaxDelinquent", () => {
  const props = parseTaxDelinquent(ROWS as any);

  it("normalizes actionable delinquencies and drops payment-agreement rows", () => {
    expect(props).toHaveLength(2);
    expect(props.map((p) => p.source)).toEqual([
      "tax_delinquent",
      "tax_delinquent",
    ]);
  });

  it("carries owner, debt, years, and a stable id in signals", () => {
    const p = props[0];
    expect(p.source_listing_id).toBe("phila-tax-41040500");
    expect((p.signals as any).total_due).toBe(4041);
    expect((p.signals as any).years_owed).toBe(7);
    expect((p.signals as any).owner).toBe("PRESSLEY DUANE");
    expect((p.signals as any).absentee).toBe(false); // mailing == situs
  });

  it("flags out-of-state absentee + sheriff sale", () => {
    const p = props[1];
    expect((p.signals as any).out_of_state_owner).toBe(true);
    expect((p.signals as any).sheriff_sale).toBe(true);
    expect(p.property_type).toBe("land");
  });
});

describe("owner-distress scoring", () => {
  it("ranks an out-of-state, multi-year, sheriff-sale delinquency very high", () => {
    const [, hot] = parseTaxDelinquent(ROWS as any);
    const s = scoreHousingLead(hot);
    expect(s.signals.join(" ")).toMatch(/Tax-delinquent/i);
    expect(s.signals.join(" ")).toMatch(/Sheriff/i);
    expect(s.signals.join(" ")).toMatch(/absentee/i);
    expect(s.tier).toBe("hot"); // stacked owner-distress signals
  });
});
