// lib/housing/property-image.ts
//
// Free, keyless AERIAL thumbnail for a property from its lat/lng (Esri World Imagery export). ~90% of our
// properties are off-market public records (absentee/tax/code/parcels) with NO listing photo — a blank
// card. An aerial of the exact parcel (roof, lot, surroundings) is genuinely useful for a lead and beats
// an empty box. Shown ONLY as a fallback, and labeled "Aerial" in the UI so it's never mistaken for a
// listing photo.

export function aerialThumb(
  lat?: number | null,
  lng?: number | null,
  w = 400,
  h = 300,
): string | null {
  if (
    lat == null ||
    lng == null ||
    !isFinite(lat) ||
    !isFinite(lng) ||
    (lat === 0 && lng === 0)
  )
    return null;
  const dx = 0.002; // ~a parcel + immediate surroundings
  const dy = 0.0015;
  const bbox = `${lng - dx},${lat - dy},${lng + dx},${lat + dy}`;
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&size=${w},${h}&format=jpg&f=image`;
}
