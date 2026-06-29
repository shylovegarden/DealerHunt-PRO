import { describe, it, expect } from "vitest";
import { parseCodeViolations } from "./code-violations";
import { scoreHousingLead } from "../lead-score";

const ROWS = [
  {
    opa_account_num: "111",
    address: "3108 N 6TH ST",
    zip: "19133",
    owner: "J BRENS PROPERTIES INC",
    violations: 30,
    severe: false,
    market_value: 90100,
    sqft: 1064,
    category: "SINGLE FAMILY",
  },
  {
    opa_account_num: "222",
    address: "5400 W THOMPSON ST",
    zip: "19131",
    owner: "DOE JANE",
    violations: 8,
    severe: true, // vacant / unsafe
    market_value: 120000,
    sqft: 1500,
    category: "MULTI FAMILY",
  },
  { opa_account_num: "333", address: "", violations: 5 }, // no address → dropped
];

describe("parseCodeViolations", () => {
  const props = parseCodeViolations(ROWS as any);

  it("builds leads with value + sqft (flip-math ready) and drops addressless rows", () => {
    expect(props).toHaveLength(2);
    const p = props[0];
    expect(p.source).toBe("code_violation");
    expect(p.price).toBe(90100);
    expect(p.sqft).toBe(1064);
    expect(p.property_type).toBe("single_family");
    expect((p.signals as any).violation_count).toBe(30);
  });

  it("flags vacant/unsafe", () => {
    expect((props[1].signals as any).vacant).toBe(true);
    expect(props[1].property_type).toBe("multi_family");
  });

  it("scores many open violations as a strong owner-distress lead", () => {
    const s = scoreHousingLead(props[0]);
    expect(s.signals.join(" ")).toMatch(/open code violation/i);
  });
});
