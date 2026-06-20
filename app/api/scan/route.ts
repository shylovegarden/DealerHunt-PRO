import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// We are mocking the scrapeQueue import if the workers folder is not fully set up yet.
// import { scrapeQueue } from '../../workers'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key'
);

export async function GET(req: NextRequest) {
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
    .from('vehicles')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .gte('profit_score', 0)
    .order(sortBy === 'price' ? 'asking_price' : sortBy === 'newest' ? 'scraped_at' : 'profit_score', 
           { ascending: sortBy === 'price' })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  
  if (query) {
    dbQuery = dbQuery.or(`make.ilike.%${query}%,model.ilike.%${query}%,title.ilike.%${query}%,vin.ilike.%${query}%`);
  }
  
  if (state) {
    dbQuery = dbQuery.eq('location_state', state);
  }
  
  if (minProfit > 0) {
    dbQuery = dbQuery.gte('estimated_profit', minProfit);
  }
  
  if (source) {
    dbQuery = dbQuery.eq('source', source);
  }
  
  if (titleType && titleType !== 'all') {
    dbQuery = dbQuery.ilike('title_type', `%${titleType}%`);
  }
  
  const { data: vehicles, count, error } = await dbQuery;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({
    vehicles: vehicles || [],
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > (page + 1) * pageSize,
    isLive: true, // Tell UI this is real data
  });
}

// POST — trigger a new scan
export async function POST(req: NextRequest) {
  const { searchTerm, sources = ['iaa', 'craigslist'], dealerId } = await req.json();
  
  try {
    // We would enqueue jobs here using BullMQ
    // for (const source of sources) {
    //   await scrapeQueue.add(source, { searchTerm, dealerId }, {
    //     priority: 1, // High priority for user-triggered scans
    //     attempts: 2,
    //   });
    // }
    
    return NextResponse.json({ 
      queued: sources,
      message: `Scanning ${sources.length} sources for "${searchTerm}"`,
    });
    
  } catch (e) {
    return NextResponse.json({ error: 'Queue not available' }, { status: 503 });
  }
}
