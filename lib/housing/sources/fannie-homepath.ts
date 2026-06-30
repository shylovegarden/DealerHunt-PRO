import type { Property, PropertyType } from "../types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function classify(raw: string): PropertyType {
  const s = (raw || "").toLowerCase();
  if (s.includes("multi") || s.includes("two to four")) return "multi_family";
  if (s.includes("condo")) return "condo";
  if (s.includes("town")) return "townhouse";
  if (s.includes("manufactured") || s.includes("mobile")) return "mobile";
  if (s.includes("land") || s.includes("plot")) return "land";
  if (s.includes("single") || s.includes("family")) return "single_family";
  return "single_family";
}

interface HomePathProperty {
  propertyUuid: string;
  propertyType: string;
  addressLine1: string;
  city: string;
  county: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  price: number;
  propertyListingStatus: string;
  listingStartDate: number;
  reoId: string;
  geoPoint: {
    latitude: number;
    longitude: number;
  };
  primHiResImageUrl: string;
  retailStatus: string;
  tenantOccupied: boolean;
  auction: boolean;
}

interface HomePathResponse {
  numProperties: number;
  totalProperties: number;
  properties: HomePathProperty[];
}

export function mapHomePathListing(p: HomePathProperty): Property | null {
  if (!p.propertyUuid || !p.price) return null;

  return {
    source: "homepath",
    source_listing_id: p.propertyUuid,
    source_url: `https://homepath.fanniemae.com/property/${p.reoId}`,
    title: [p.addressLine1, p.city, p.state].filter(Boolean).join(", "),
    property_type: classify(p.propertyType || ""),
    description: `Fannie Mae HomePath REO — ${p.retailStatus || p.propertyListingStatus}${
      p.tenantOccupied ? " (Tenant Occupied)" : ""
    }${p.auction ? " (Auction)" : ""}`,
    address: p.addressLine1?.trim(),
    city: p.city?.trim(),
    state: p.state?.trim(),
    zip: p.zipCode?.trim(),
    lat: p.geoPoint?.latitude,
    lng: p.geoPoint?.longitude,
    price: p.price,
    beds: p.bedrooms,
    baths: p.bathrooms,
    sqft: p.sqft,
    year_built: p.yearBuilt,
    images: p.primHiResImageUrl ? [p.primHiResImageUrl] : [],
    seller: "Fannie Mae",
    seller_type: "gov",
    signals: {
      channel: "reo",
      status: p.retailStatus,
      tenantOccupied: p.tenantOccupied,
      marketplace: "homepath",
    },
    scraped_at: new Date().toISOString(),
  };
}

export async function fetchHomePathRegion(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  delayMs = 500,
  depth = 0,
): Promise<HomePathProperty[]> {
  const url = `https://homepath.fanniemae.com/cfl/property-inventory/search?bounds=${minLat},${minLng},${maxLat},${maxLng}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "x-fnma-channel": "web",
      "x-fnma-entity-id": "",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`HomePath API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as HomePathResponse;
  let results = data.properties || [];

  if (data.totalProperties > 400 && depth < 12) {
    // The API hard-caps at 400. We must subdivide the bounding box.
    console.log(
      `[HomePath] Region ${minLat},${minLng} to ${maxLat},${maxLng} has ${data.totalProperties} > 400. Subdividing (depth ${depth})...`,
    );
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;

    const quadrants = [
      [minLat, minLng, midLat, midLng],
      [midLat, minLng, maxLat, midLng],
      [minLat, midLng, midLat, maxLng],
      [midLat, midLng, maxLat, maxLng],
    ];

    results = [];
    for (const [qMinLat, qMinLng, qMaxLat, qMaxLng] of quadrants) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const qResults = await fetchHomePathRegion(
        qMinLat,
        qMinLng,
        qMaxLat,
        qMaxLng,
        delayMs,
        depth + 1,
      );
      results.push(...qResults);
    }
  } else if (data.totalProperties > 400) {
    console.warn(
      `[HomePath] Region ${minLat},${minLng} to ${maxLat},${maxLng} has ${data.totalProperties} > 400, but reached max depth. Returning partial results.`,
    );
  }
  return results;
}

export async function scrapeHomePath(delayMs = 500): Promise<Property[]> {
  console.log("[HomeIQ:HomePath] harvesting Fannie Mae REO homes...");

  // US Bounding Box (approx)
  const minLat = 24.396308;
  const minLng = -125.0;
  const maxLat = 49.384358;
  const maxLng = -66.93457;

  try {
    const rawProperties = await fetchHomePathRegion(
      minLat,
      minLng,
      maxLat,
      maxLng,
      delayMs,
    );
    const byId = new Map<string, Property>();

    for (const r of rawProperties) {
      const p = mapHomePathListing(r);
      if (p) byId.set(p.source_listing_id!, p);
    }

    const properties = Array.from(byId.values());
    console.log(`[HomeIQ:HomePath] found ${properties.length} homes`);
    return properties;
  } catch (e) {
    console.error(`[HomeIQ:HomePath] Failed to scrape HomePath:`, e);
    return [];
  }
}
