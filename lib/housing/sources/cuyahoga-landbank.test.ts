import { describe, it, expect } from "vitest";
import { parseCuyahogaLandBank } from "./cuyahoga-landbank";

// Fixture mirrors the real `var markersOnMap = [...]` blob on cuyahogalandbank.org/all-available-properties:
// parcel #, precise LatLng, Google-storage image, and a "address<br><br>status" content string.
const FIXTURE = `
<script>
var centerCords = {lat:41.4,lng:-81.6};
var markersOnMap = [
{"placeName":"140-17-057","LatLng":{"lat":41.450971,"lng":-81.557109},"image":"https://storage.googleapis.com/cclrc-pps2.appspot.com/x/DSCN7546.JPG","ppn":"140-17-057","content":"17425 Eldamere Ave, Cleveland, OH 44128<br><br>Renovation Underway - Available Soon"},
{"placeName":"541-12-123","LatLng":{"lat":41.43131,"lng":-81.624473},"image":"https://storage.googleapis.com/cclrc-pps2.appspot.com/y/DSCN4139.JPG","ppn":"541-12-123","content":"4707 E 86th St, Garfield Heights, OH 44125<br><br>Vacant Land - Available"}
];
</script>`;

describe("parseCuyahogaLandBank", () => {
  const rows = parseCuyahogaLandBank(FIXTURE);

  it("extracts markers from the embedded markersOnMap blob", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("land_bank");
    expect(rows[0].source_listing_id).toBe("cclb-140-17-057");
  });

  it("parses address/city/state/zip and precise coords from the content + LatLng", () => {
    const p = rows[0];
    expect(p.address).toBe("17425 Eldamere Ave");
    expect(p.city).toBe("Cleveland");
    expect(p.state).toBe("OH");
    expect(p.zip).toBe("44128");
    expect(p.lat).toBeCloseTo(41.451, 2);
    expect(p.lng).toBeCloseTo(-81.557, 2);
    expect(p.seller).toBe("Cuyahoga Land Bank");
    expect(p.images?.[0]).toContain("storage.googleapis.com");
    expect(p.description).toBe("Renovation Underway - Available Soon");
    expect(p.property_type).toBe("single_family");
  });

  it("classifies a vacant-land parcel as land (suburb city preserved)", () => {
    const p = rows[1];
    expect(p.city).toBe("Garfield Heights");
    expect(p.property_type).toBe("land");
    expect(p.signals?.parcel).toBe("541-12-123");
  });

  it("is vertical-isolated — Property fields only, no vehicle fields", () => {
    for (const p of rows) {
      expect(p).not.toHaveProperty("make");
      expect(p).not.toHaveProperty("year");
      expect(p.address).toBeTruthy();
    }
  });

  it("returns [] when no markersOnMap blob is present", () => {
    expect(parseCuyahogaLandBank("<html>nothing</html>")).toEqual([]);
  });
});
