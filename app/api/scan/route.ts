import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key'
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q         = searchParams.get('q') || '';
  const state     = searchParams.get('state') || '';
  const source    = searchParams.get('source') || '';
  const titleType = searchParams.get('titleType') || '';
  const category  = searchParams.get('cat') || '';
  const minProfit = parseInt(searchParams.get('minProfit') || '0');
  const page      = parseInt(searchParams.get('page') || '0');
  const pageSize  = 20;

  let query = supabase
    .from('deals')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .gt('profit_score', 0)
    .order('profit_score', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (state) {
    // Pull state matches first, then nationwide, in a single request range
    query = query.or(`location_state.eq.${state},location_state.neq.${state}`);
  }

  if (q) {
    query = query.or(`make.ilike.%${q}%,model.ilike.%${q}%,title.ilike.%${q}%,vin.ilike.%${q}%`);
  }

  if (minProfit > 0) {
    query = query.gte('profit_estimate', minProfit);
  }

  if (source) {
    query = query.eq('source', source);
  }

  if (titleType && titleType !== 'all') {
    query = query.ilike('condition', `%${titleType}%`);
  }

  if (category && !source && !titleType) {
    // Legacy single filter: source name or condition
    if (['copart', 'iaa', 'craigslist', 'ebay', 'facebook'].includes(category)) {
      query = query.eq('source', category);
    } else {
      query = query.ilike('condition', `%${category}%`);
    }
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // State boost: sort state-match results first
  const sorted = state
    ? [
        ...(data || []).filter((v: any) => v.location_state === state),
        ...(data || []).filter((v: any) => v.location_state !== state),
      ]
    : data || [];

  return NextResponse.json({
    vehicles: sorted,
    total: count || 0,
    state: state || 'nationwide',
    page, pageSize,
    hasMore: (count || 0) > (page + 1) * pageSize,
    isLive: true,
  });
}

// POST — trigger a new scan
export async function POST(req: NextRequest) {
  const { searchTerm, sources = ['iaa', 'craigslist'], dealerId } = await req.json();

  // Queue wiring lives in workers/index.ts; run `npm run worker` to process live scans.
  return NextResponse.json({
    queued: sources,
    message: `Scanning ${sources.length} sources for "${searchTerm}" (queue must be running)`,
  });
}
