export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidVin, normalizeVin } from "@/lib/vehicle/vin";
import { decodeVin, getRecallCount } from "@/lib/vehicle/nhtsa";

// GET /api/vin/[vin]/specs — authoritative, FREE vehicle specs (NHTSA vPIC) + open recall count
// (NHTSA Recalls), cached in vin_decodes. Decode is immutable per VIN; recalls refresh weekly.
const RECALLS_TTL_MS = 7 * 24 * 3600_000;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vin: string }> },
) {
  const { vin: raw } = await params;
  const vin = normalizeVin(raw);
  if (!isValidVin(vin))
    return NextResponse.json({ error: "Invalid VIN" }, { status: 400 });

  const sb = admin();
  const { data: cached } = await sb
    .from("vin_decodes")
    .select("*")
    .eq("vin", vin)
    .maybeSingle();

  const recallsFresh =
    cached?.recalls_at &&
    Date.now() - new Date(cached.recalls_at).getTime() < RECALLS_TTL_MS;

  if (cached && recallsFresh) {
    return NextResponse.json({ vin, ...toResponse(cached), cached: true });
  }

  // Decode (use cache if present, else NHTSA) + refresh recalls.
  const decoded = cached?.make ? toDecode(cached) : await decodeVin(vin);
  if (!decoded)
    return NextResponse.json(
      { error: "Could not decode VIN" },
      { status: 404 },
    );

  const recalls =
    decoded.make && decoded.model && decoded.year
      ? await getRecallCount(decoded.make, decoded.model, decoded.year)
      : null;

  const row = {
    vin,
    year: decoded.year,
    make: decoded.make,
    model: decoded.model,
    trim: decoded.trim,
    body_class: decoded.bodyClass,
    drive_type: decoded.driveType,
    fuel_type: decoded.fuelType,
    cylinders: decoded.cylinders,
    displacement_l: decoded.displacementL,
    plant_country: decoded.plantCountry,
    made_in_usa: decoded.madeInUsa,
    recalls_count: recalls,
    recalls_at:
      recalls != null ? new Date().toISOString() : (cached?.recalls_at ?? null),
  };
  sb.from("vin_decodes")
    .upsert(row, { onConflict: "vin" })
    .then(
      () => {},
      () => {},
    );

  return NextResponse.json({ vin, ...toResponse(row), cached: false });
}

function toDecode(c: any) {
  return {
    year: c.year,
    make: c.make,
    model: c.model,
    trim: c.trim,
    bodyClass: c.body_class,
    driveType: c.drive_type,
    fuelType: c.fuel_type,
    cylinders: c.cylinders,
    displacementL: c.displacement_l,
    plantCountry: c.plant_country,
    madeInUsa: c.made_in_usa,
  };
}

function toResponse(c: any) {
  return {
    year: c.year,
    make: c.make,
    model: c.model,
    trim: c.trim,
    bodyClass: c.body_class,
    driveType: c.drive_type,
    fuelType: c.fuel_type,
    cylinders: c.cylinders,
    displacementL: c.displacement_l,
    plantCountry: c.plant_country,
    madeInUsa: c.made_in_usa,
    recalls: c.recalls_count,
  };
}
