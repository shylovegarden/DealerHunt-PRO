import { describe, it, expect } from "vitest";
import { parseGeneseeLandBank } from "./genesee-landbank";

// Fixture mirrors a real Genesee find_properties.asp result row: a checkbox carrying
// "parcel|street|city|zip" then rowtext cells in order street, city, zip, class, saleType, with the
// parcel detail link. Two rows — a vacant lot and a residential structure — to exercise classify.
const FIXTURE = `
<table>
<tr><td><input type="checkbox" name="LRClistChk" id="c0" value="0207551011|NO FRONTAGE|GRAND BLANC|48439">
<label for="c0"><a href="property_sheet.asp?pid=0207551011&loc=1&from=main">02-07-551-011</a></label></td>
<td><div class="rowtext">NO FRONTAGE</div></td><td><div class="rowtext">GRAND BLANC</div></td>
<td><div class="rowtext">48439</div></td><td><div class="rowtext">Res Vac Lot</div></td>
<td><div class="rowtext">Vacant Land</div></td></tr>
<tr><td><input type="checkbox" name="LRClistChk" id="c1" value="0411200015|1234 MAIN ST|FLINT|48503">
<label for="c1"><a href="property_sheet.asp?pid=0411200015">04-11-200-015</a></label></td>
<td><div class="rowtext">1234 MAIN ST</div></td><td><div class="rowtext">FLINT</div></td>
<td><div class="rowtext">48503</div></td><td><div class="rowtext">Res w/Structure</div></td>
<td><div class="rowtext">Home for Sale</div></td></tr>
</table>`;

describe("parseGeneseeLandBank", () => {
  const rows = parseGeneseeLandBank(FIXTURE);

  it("parses parcel|street|city|zip from the checkbox value", () => {
    expect(rows).toHaveLength(2);
    const p = rows[0];
    expect(p.source).toBe("land_bank");
    expect(p.source_listing_id).toBe("genlb-0207551011");
    expect(p.address).toBe("NO FRONTAGE");
    expect(p.city).toBe("GRAND BLANC");
    expect(p.state).toBe("MI");
    expect(p.zip).toBe("48439");
    expect(p.signals?.parcel).toBe("02-07-551-011");
    expect(p.source_url).toContain("property_sheet.asp?pid=0207551011");
  });

  it("classifies from the property-class cell (not the street cell)", () => {
    expect(rows[0].property_type).toBe("land"); // Res Vac Lot
    expect(rows[0].signals?.property_class).toBe("Res Vac Lot");
    expect(rows[1].property_type).toBe("single_family"); // Res w/Structure
    expect(rows[1].address).toBe("1234 MAIN ST");
    expect(rows[1].signals?.sale_type).toBe("Home for Sale");
  });

  it("is vertical-isolated — Property fields only, no vehicle fields", () => {
    for (const p of rows) {
      expect(p).not.toHaveProperty("make");
      expect(p).not.toHaveProperty("year");
      expect(p.state).toBe("MI");
    }
  });

  it("returns [] when there are no result rows", () => {
    expect(
      parseGeneseeLandBank("<table><tr><td>no results</td></tr></table>"),
    ).toEqual([]);
  });
});
