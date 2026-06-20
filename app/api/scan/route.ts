import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key'
);

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const query     = searchParams.get('q') || '';
  const state     = searchParams.get('state') || '';
  const minProfit = parseInt(searchParams.get('minProfit') || '0');
  const source    = searchParams.get('source') || '';
  const titleType = searchParams.get('titleType') || '';
  const sortBy    = searchParams.get('sort') || 'profit_score';
  const page      = parseInt(searchParams.get('page') || '0');
  const pageSize  = 20;

  let dbQuery = supabase
    .from('deals')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .gte('profit_score', 0)
    .order(sortBy === 'price' ? 'ask_price' : sortBy === 'newest' ? 'last_seen_at' : 'profit_score',
           { ascending: sortBy === 'price' })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (query) {
    dbQuery = dbQuery.or(`make.ilike.%${query}%,model.ilike.%${query}%,title.ilike.%${query}%,vin.ilike.%${query}%`);
  }

  if (state) {
    dbQuery = dbQuery.eq('location_state', state);
  }

  if (minProfit > 0) {
    dbQuery = dbQuery.gte('profit_estimate', minProfit);
  }

  if (source) {
    dbQuery = dbQuery.eq('source', source);
  }

  if (titleType && titleType !== 'all') {
    dbQuery = dbQuery.ilike('condition', `%${titleType}%`);
  }

  const { data: deals, count, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    deals: deals || [],
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > (page + 1) * pageSize,
    isLive: true,
  });
}

// POST — trigger a new scan
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const { searchTerm, sources = ['iaa', 'craigslist'], dealerId } = await req.json();

  // For now, the queue is not wired. Return a clear message and the sources that should be queued.
  return NextResponse.json({
    queued: [],
    message: `Scraper queue is not yet running. Add sources ${sources.join(', ')} to BullMQ and run "npm run worker" to enable live scans for "${searchTerm}".`,
  }, { status: 202 });
}
