import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key'
);

export async function checkAlerts() {
  // Get all active alerts
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*, dealers(email, plan)')
    .eq('active', true);

  if (!alerts?.length) return;

  // Get deals added in last 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: newDeals } = await supabase
    .from('deals')
    .select('*')
    .gte('scraped_at', since)
    .eq('active', true);

  if (!newDeals?.length) return;

  for (const alert of alerts) {
    for (const deal of newDeals) {
      if (vehicleMatchesAlert(deal, alert)) {
        // Insert match
        await supabase.from('alert_matches').upsert({
          alert_id: alert.id,
          deal_id: deal.id,
          dealer_id: alert.dealer_id,
          profit_estimate: deal.profit_estimate,
          notified: false,
        }, { onConflict: 'alert_id,deal_id', ignoreDuplicates: true });

        // Update alert trigger count
        await supabase.from('alerts')
          .update({ last_triggered: new Date().toISOString() })
          .eq('id', alert.id);
      }
    }
  }
}

function vehicleMatchesAlert(vehicle: any, alert: any): boolean {
  if (alert.make && vehicle.make?.toLowerCase() !== alert.make.toLowerCase()) return false;
  if (alert.model && !vehicle.model?.toLowerCase().includes(alert.model.toLowerCase())) return false;
  if (alert.year_min && vehicle.year < alert.year_min) return false;
  if (alert.year_max && vehicle.year > alert.year_max) return false;
  if (alert.max_price && vehicle.asking_price > alert.max_price) return false;
  if (alert.max_odometer && vehicle.odometer > alert.max_odometer) return false;
  if (alert.min_profit && (vehicle.estimated_profit || 0) < alert.min_profit) return false;
  if (alert.states?.length && !alert.states.includes(vehicle.location_state)) return false;
  return true;
}
