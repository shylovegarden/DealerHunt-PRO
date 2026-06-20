import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key'
);

export async function getMarketDemand(make: string, model: string, state: string) {
  // Query Supabase: how many of this make/model in this state
  const { count: activeListings } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .ilike('make', make)
    .ilike('model', `%${model}%`)
    .eq('location_state', state)
    .eq('is_active', true);
  
  // Days supply calculation: < 30 = high demand, 30-60 = normal, > 60 = soft
  const demandLevel = (activeListings || 0) < 20 ? 'high' : (activeListings || 0) < 50 ? 'normal' : 'soft';
  
  return {
    activeListings,
    demandLevel,
    pricingAdvice: demandLevel === 'high'
      ? 'High demand — price at or above MMR'
      : demandLevel === 'normal'
      ? 'Normal market — price at MMR'
      : 'Soft market — price 3-5% below MMR to move fast',
  };
}
