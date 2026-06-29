import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchOpenData, type OpenDataSource } from "./open-data";

afterEach(() => vi.unstubAllGlobals());

describe("fetchOpenData — Socrata", () => {
  it("pages, maps rows, and carries distress signals", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      addr: `${i} MAIN ST`,
      val: 50000 + i,
      latitude: 38.6,
      longitude: -90.2,
    }));
    const page2 = [{ addr: "LAST ST", val: 99999 }];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });
    vi.stubGlobal("fetch", fetchMock);

    const cfg: OpenDataSource = {
      source: "stl_vacant",
      api: "socrata",
      url: "https://data.stlouis-mo.gov/resource/abcd.json",
      state: "MO",
      city: "St. Louis",
      limit: 2000,
      map: (a, g) => ({
        source: "stl_vacant",
        title: `Vacant · ${a.addr}`,
        address: a.addr,
        state: "MO",
        city: "St. Louis",
        price: Number(a.val) || undefined,
        lat: g.lat,
        lng: g.lng,
        signals: { vacant: true },
      }),
    };
    const out = await fetchOpenData(cfg);
    expect(out).toHaveLength(1001);
    expect(out[0].source).toBe("stl_vacant");
    expect(out[0].lat).toBe(38.6);
    expect((out[0].signals as any).vacant).toBe(true);
    // second (short) page ended pagination — no third call
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns [] on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const out = await fetchOpenData({
      source: "x",
      api: "socrata",
      url: "https://e/r.json",
      state: "MO",
      map: () => null,
    });
    expect(out).toEqual([]);
  });
});

describe("fetchOpenData — ArcGIS", () => {
  it("reads features + geometry and maps them", async () => {
    const features = [
      {
        attributes: { OWNER: "DOE JANE", APPRVAL: 80000, ADDR: "1 OAK" },
        geometry: { x: -90.19, y: 38.62 },
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features }) }),
    );
    const out = await fetchOpenData({
      source: "stlco_parcel",
      api: "arcgis",
      url: "https://gis/FeatureServer/0",
      state: "MO",
      limit: 1000,
      map: (a, g) => ({
        source: "stlco_parcel",
        title: a.ADDR,
        address: a.ADDR,
        state: "MO",
        price: Number(a.APPRVAL) || undefined,
        lat: g.lat,
        lng: g.lng,
        signals: { owner: a.OWNER },
      }),
    });
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBe(38.62);
    expect(out[0].lng).toBe(-90.19);
    expect((out[0].signals as any).owner).toBe("DOE JANE");
  });
});
