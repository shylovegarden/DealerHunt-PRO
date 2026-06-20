import { NextRequest, NextResponse } from 'next/server';

// Mileage lookup table for common state pairs
const STATE_CENTERS: Record<string, [number, number]> = {
  AL:[32.806671,-86.791130],AK:[61.370716,-152.404419],AZ:[33.729759,-111.431221],
  AR:[34.969704,-92.373123],CA:[36.116203,-119.681564],CO:[39.059811,-105.311104],
  CT:[41.597782,-72.755371],FL:[27.766279,-81.686783],GA:[33.040619,-83.643074],
  ID:[44.240459,-114.478828],IL:[40.349457,-88.986137],IN:[39.849426,-86.258278],
  IA:[42.011539,-93.210526],KS:[38.526600,-96.726486],KY:[37.668140,-84.670067],
  LA:[31.169960,-91.867805],MD:[39.063946,-76.802101],MA:[42.230171,-71.530106],
  MI:[43.326618,-84.536095],MN:[45.694454,-93.900192],MS:[32.741646,-89.678696],
  MO:[38.456085,-92.288368],MT:[46.921925,-110.454353],NE:[41.125370,-98.268082],
  NV:[38.313515,-117.055374],NJ:[40.298904,-74.521011],NM:[34.840515,-106.248482],
  NY:[42.165726,-74.948051],NC:[35.630066,-79.806419],OH:[40.388783,-82.764915],
  OK:[35.565342,-96.928917],OR:[44.572021,-122.070938],PA:[40.590752,-77.209755],
  SC:[33.856892,-80.945007],TN:[35.747845,-86.692345],TX:[31.054487,-97.563461],
  UT:[40.150032,-111.862434],VA:[37.769337,-78.169968],WA:[47.400902,-121.490494],
  WI:[44.268543,-89.616508],
};

function distanceMiles(from: string, to: string): number {
  const [lat1, lon1] = STATE_CENTERS[from] || [37, -95];
  const [lat2, lon2] = STATE_CENTERS[to] || [37, -95];
  
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

export async function POST(req: NextRequest) {
  const { fromState, toState, miles: inputMiles, trailerType = 'open', condition = 'running' } = await req.json();
  
  if (!fromState || !toState) {
    return NextResponse.json({ error: 'fromState and toState required' }, { status: 400 });
  }
  
  const miles = inputMiles || distanceMiles(fromState, toState);
  const inoperable = condition === 'inoperable';
  
  const rates = {
    open:     { min: 0.72, mid: 0.80, max: 0.92 },
    enclosed: { min: 1.18, mid: 1.28, max: 1.45 },
  };
  
  const r = rates[trailerType as 'open' | 'enclosed'] || rates.open;
  const inopSurcharge = inoperable ? 150 : 0;
  
  const minimums = { open: 350, enclosed: 600 };
  const minimum = minimums[trailerType as 'open' | 'enclosed'] || 350;
  
  const budget   = Math.max(minimum, Math.round(miles * r.min)) + inopSurcharge;
  const standard = Math.max(minimum, Math.round(miles * r.mid)) + inopSurcharge;
  const express  = Math.max(minimum, Math.round(miles * r.max)) + inopSurcharge;
  
  return NextResponse.json({
    fromState, toState, miles, trailerType,
    quotes: [
      { carrier: 'uShip Network',   price: budget,   priceHigh: budget + 80,   days: '4-7', type: 'budget',   rating: 4.6 },
      { carrier: 'Montway Auto',    price: standard, priceHigh: standard + 60, days: '3-5', type: 'standard', rating: 4.8 },
      { carrier: 'SGT Auto',        price: express,  priceHigh: express + 50,  days: '2-4', type: 'express',  rating: 4.7 },
    ],
    note: 'Estimates based on industry rates. Actual quotes may vary by ±15%.',
  });
}
