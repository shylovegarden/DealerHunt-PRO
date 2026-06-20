export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { DealScoringService } from '@/lib/scrapers/tools/deal-scoring';
import { extractYear, extractMake, extractModel } from '@/lib/scrapers/tools/deal-normalizer';

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Quick validation
    if (!data.url || !data.price || !data.title) {
      return NextResponse.json({ error: 'Missing required fields (url, price, title)' }, { status: 400 });
    }

    const supabase = createServerComponentClient();
    const rawPrice = parseFloat(data.price.replace(/[^0-9.]/g, '')) || 0;

    // Parse basic fields from title
    const year = extractYear(data.title) || data.year;
    const make = extractMake(data.title) || data.make;
    const model = extractModel(data.title, make) || data.model;

    // Try to fetch market value if VIN is provided
    let mmrValue: number | null = null;
    if (data.vin && data.vin.length === 17) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/value/${data.vin}`);
        if (res.ok) {
          const valueData = await res.json();
          mmrValue = valueData.marketValue || null;
        }
      } catch {}
    }

    // Build a partial deal and score it
    const deal: any = {
      source: data.source || 'extension',
      source_deal_id: data.external_id || data.url,
      source_url: data.url,
      title: data.title,
      year,
      make,
      model,
      vin: data.vin,
      ask_price: rawPrice,
      condition: data.title_type || data.condition || 'unknown',
      damage_type: data.damage_type,
      images: data.image_url ? [data.image_url] : [],
      description: data.description,
      location: data.location,
      seller_type: 'private',
      mmr_value: mmrValue,
      scraped_at: new Date().toISOString(),
    };

    const scorer = new DealScoringService();
    const scored = scorer.scoreDeal(deal);
    const insert = { ...deal, ...scored };

    const { data: saved, error } = await supabase
      .from('deals')
      .insert([insert])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deal: saved }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error: any) {
    console.error('Ingest Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Support preflight CORS for the Chrome Extension
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
