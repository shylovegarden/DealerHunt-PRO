import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key'
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;
  
  // Check cache first (vehicles table has market_value)
  const { data: cached } = await supabase
    .from('vehicles')
    .select('market_value, updated_at')
    .eq('vin', vin)
    .not('market_value', 'is', null)
    .gte('updated_at', new Date(Date.now() - 86400000).toISOString()) // 24hr cache
    .single();
  
  if (cached?.market_value) {
    return NextResponse.json({
      vin,
      marketValue: cached.market_value,
      source: 'cache',
    });
  }
  
  // Fetch from MarketCheck
  if (!process.env.MARKETCHECK_API_KEY) {
    // Fallback: estimate based on typical ranges
    return NextResponse.json({ vin, marketValue: null, source: 'no_api_key' });
  }
  
  try {
    const res = await fetch(
      `https://marketcheck-prod.apigee.net/v2/search/car/active?api_key=${process.env.MARKETCHECK_API_KEY}&vin=${vin}&rows=10`,
      { next: { revalidate: 3600 } }
    );
    
    if (!res.ok) throw new Error(`MarketCheck ${res.status}`);
    
    const data = await res.json();
    const prices = data.deals
      ?.map((l: any) => l.price)
      .filter((p: number) => p > 1000) || [];
    
    if (!prices.length) {
      return NextResponse.json({ vin, marketValue: null, source: 'no_deals' });
    }
    
    const marketValue = Math.round(
      prices.reduce((a: number, b: number) => a + b, 0) / prices.length
    );
    
    return NextResponse.json({
      vin,
      marketValue,
      comparables: prices.length,
      avgDaysOnMarket: data.deals?.[0]?.dom || null,
      source: 'marketcheck',
    });
    
  } catch (e) {
    return NextResponse.json({ error: 'MarketCheck API error', vin }, { status: 500 });
  }
}
