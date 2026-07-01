import { describe, it, expect } from "vitest";
import { parseStateCodes, parsePropertyTable } from "./usda-resales";

const SAMPLE_GET = `
<html>
<body>
  <select id="stateCode">
    <option value=""></option>
    <option value="13">Georgia (2)</option>
    <option value="28">Mississippi (5)</option>
  </select>
</body>
</html>
`;

const SAMPLE_POST_SFH = `
<table id="propertySummariesTable">
  <tbody>
    <tr>
      <td>
        <a href="/resales/public/SFHPropertyDetail?id=6278&amp;listingType=Foreclosure">
          <img src="/SFH_INTRANET/1.jpg">
        </a>
      </td>
      <td>Foreclosure</td>
      <td>1687 Arnold Drive Map</td>
      <td>Starkville</td>
      <td>Mississippi</td>
      <td>Oktibbeha</td>
      <td>39759</td>
      <td>$31,884</td>
      <td>3</td>
      <td>2</td>
      <td>1460</td>
    </tr>
  </tbody>
</table>
`;

describe("parseStateCodes", () => {
  it("extracts non-empty stateCode option values", () => {
    const codes = parseStateCodes(SAMPLE_GET);
    expect(codes).toEqual(["13", "28"]);
  });
});

describe("parsePropertyTable", () => {
  it("parses SFH rows correctly", () => {
    const category = {
      path: "/resales/public/searchSFH",
      propertyType: "Single Family" as const,
      canonicalType: "single_family" as const,
    };
    const props = parsePropertyTable(SAMPLE_POST_SFH, category);
    expect(props).toHaveLength(1);

    const p = props[0];
    expect(p.source).toBe("usda_resales");
    expect(p.source_listing_id).toBe("usda-singlefamily-6278");
    expect(p.source_url).toBe(
      "https://www.resales.usda.gov/resales/public/SFHPropertyDetail?id=6278&listingType=Foreclosure",
    );
    expect(p.property_type).toBe("single_family");
    expect(p.address).toBe("1687 Arnold Drive");
    expect(p.city).toBe("Starkville");
    expect(p.state).toBe("Mississippi");
    expect(p.signals?.county).toBe("Oktibbeha");
    expect(p.zip).toBe("39759");
    expect(p.price).toBe(31884);
    expect(p.beds).toBe(3);
    expect(p.baths).toBe(2);
    expect(p.sqft).toBe(1460);
    expect(p.seller_type).toBe("gov");
    expect(p.images).toEqual([
      "https://www.resales.usda.gov/SFH_INTRANET/1.jpg",
    ]);
  });
});
