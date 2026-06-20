import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;
  
  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: 'Invalid VIN — must be 17 characters' }, { status: 400 });
  }
  
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`,
      { next: { revalidate: 86400 } } // Cache 24hrs
    );
    
    const data = await res.json();
    const r = data.Results?.[0];
    
    if (!r || r.ErrorCode !== '0') {
      return NextResponse.json({ error: 'VIN not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      vin,
      year:         r.ModelYear,
      make:         r.Make,
      model:        r.Model,
      trim:         r.Trim,
      bodyStyle:    r.BodyClass,
      drivetrain:   r.DriveType,
      fuelType:     r.FuelTypePrimary,
      engine:       r.EngineConfiguration,
      cylinders:    r.EngineCylinders,
      displacement: r.DisplacementL,
      transmission: r.TransmissionStyle,
      plantCountry: r.PlantCountry,
    });
    
  } catch (e) {
    return NextResponse.json({ error: 'NHTSA API error' }, { status: 500 });
  }
}
