// lib/housing/property-image.ts
//
// Free, keyless AERIAL thumbnail for a property from its lat/lng (Esri World Imagery export). ~90% of our
// properties are off-market public records (absentee/tax/code/parcels) with NO listing photo — a blank
// card. An aerial of the exact parcel (roof, lot, surroundings) is genuinely useful for a lead and beats
// an empty box. Shown ONLY as a fallback, and labeled "Aerial" in the UI so it's never mistaken for a
// listing photo.

import { resolveChain } from "@/lib/resolve";

const validLatLng = (lat?: number | null, lng?: number | null): boolean =>
  lat != null &&
  lng != null &&
  isFinite(lat) &&
  isFinite(lng) &&
  !(lat === 0 && lng === 0);

const bboxFor = (lat: number, lng: number): string =>
  // ~a parcel + immediate surroundings.
  `${lng - 0.002},${lat - 0.0015},${lng + 0.002},${lat + 0.0015}`;

export function aerialThumb(
  lat?: number | null,
  lng?: number | null,
  w = 400,
  h = 300,
): string | null {
  if (!validLatLng(lat, lng)) return null;
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bboxFor(lat!, lng!)}&bboxSR=4326&size=${w},${h}&format=jpg&f=image`;
}

// Free, keyless STREET basemap (same reliable Esri provider as the aerial) — the last visual fallback when
// there's no listing photo AND the aerial export is unavailable, so a card is never a blank box.
export function streetMapThumb(
  lat?: number | null,
  lng?: number | null,
  w = 400,
  h = 300,
): string | null {
  if (!validLatLng(lat, lng)) return null;
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/export?bbox=${bboxFor(lat!, lng!)}&bboxSR=4326&size=${w},${h}&format=jpg&f=image`;
}

export type PropertyImageKind = "listing" | "aerial" | "map";
export interface ResolvedImage {
  url: string;
  kind: PropertyImageKind;
}

// The property-photo FALLBACK CHAIN in one place (was duplicated as `image || aerialThumb` across the
// leads, detail, and compare surfaces). Real listing photo → exact-parcel aerial → street basemap. `kind`
// lets the UI badge it honestly — never passing an aerial/map off as a real listing photo.
export function resolvePropertyImage(p: {
  image?: string | null;
  lat?: number | null;
  lng?: number | null;
}): ResolvedImage | null {
  const r = resolveChain<ResolvedImage>([
    {
      name: "listing",
      get: () => (p.image ? { url: p.image, kind: "listing" } : null),
    },
    {
      name: "aerial",
      get: () => {
        const u = aerialThumb(p.lat, p.lng);
        return u ? { url: u, kind: "aerial" as const } : null;
      },
    },
    {
      name: "map",
      get: () => {
        const u = streetMapThumb(p.lat, p.lng);
        return u ? { url: u, kind: "map" as const } : null;
      },
    },
  ]);
  return r?.value ?? null;
}
