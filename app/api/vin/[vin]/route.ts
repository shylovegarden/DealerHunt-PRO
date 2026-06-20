import { NextRequest, NextResponse } from 'next/server';
import { decodeVIN } from '@/lib/api/vin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;
  
  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: 'Invalid VIN — must be 17 characters' }, { status: 400 });
  }
  
  try {
    const data = await decodeVIN(vin);
    if (!data) {
      return NextResponse.json({ error: 'VIN not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'VIN API error' }, { status: 500 });
  }
}
