import { createServerComponentClient } from "@/lib/supabase";

const supabase = createServerComponentClient();

export async function checkAlerts() {
  console.log("[ALERT-ENGINE] Running alert engine...");

  // Get all active alerts
  const { data: alerts, error: alertsErr } = await supabase
    .from("alerts")
    .select("*")
    .eq("active", true);

  if (alertsErr) {
    console.error("[ALERT-ENGINE] Error fetching alerts:", alertsErr.message);
    return;
  }

  if (!alerts?.length) {
    console.log("[ALERT-ENGINE] No active alerts found.");
    return;
  }

  // Get deals added in last 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: newDeals, error: dealsErr } = await supabase
    .from("deals")
    .select("*")
    .gte("created_at", since)
    .eq("active", true);

  if (dealsErr) {
    console.error("[ALERT-ENGINE] Error fetching new deals:", dealsErr.message);
    return;
  }

  if (!newDeals?.length) {
    console.log("[ALERT-ENGINE] No new deals found in last 10 minutes.");
    return;
  }

  console.log(
    `[ALERT-ENGINE] Matching ${alerts.length} alerts against ${newDeals.length} new deals...`,
  );

  for (const alert of alerts) {
    for (const deal of newDeals) {
      if (vehicleMatchesAlert(deal, alert)) {
        console.log(
          `[ALERT-ENGINE] Match found! Deal ${deal.id} matches alert ${alert.id} for dealer ${alert.dealer_id}`,
        );

        // Check if already matched
        const { data: existing } = await supabase
          .from("alert_matches")
          .select("id")
          .eq("alert_id", alert.id)
          .eq("deal_id", deal.id)
          .maybeSingle();

        if (existing) continue;

        // Insert match
        const { error: matchErr } = await supabase
          .from("alert_matches")
          .insert({
            alert_id: alert.id,
            deal_id: deal.id,
            dealer_id: alert.dealer_id,
            profit_estimate: deal.profit_estimate,
            notified: false,
          });

        if (matchErr) {
          console.error(
            `[ALERT-ENGINE] Error inserting match:`,
            matchErr.message,
          );
        } else {
          // Update alert trigger count and last triggered time
          const currentCount = alert.trigger_count || 0;
          await supabase
            .from("alerts")
            .update({
              last_triggered_at: new Date().toISOString(),
              trigger_count: currentCount + 1,
            })
            .eq("id", alert.id);
        }
      }
    }
  }
}

function vehicleMatchesAlert(vehicle: any, alert: any): boolean {
  const f = alert.filters || {};

  if (f.make && vehicle.make?.toLowerCase() !== f.make.toLowerCase())
    return false;
  if (f.model && !vehicle.model?.toLowerCase().includes(f.model.toLowerCase()))
    return false;
  if (f.year_min && vehicle.year < f.year_min) return false;
  if (f.year_max && vehicle.year > f.year_max) return false;

  // asking_price -> ask_price
  if (f.max_price && vehicle.ask_price > f.max_price) return false;

  // odometer -> mileage
  if (f.max_odometer && vehicle.mileage > f.max_odometer) return false;

  // estimated_profit -> profit_estimate
  if (f.min_profit && (vehicle.profit_estimate || 0) < f.min_profit)
    return false;

  // states -> target_states
  if (f.states?.length && !f.states.includes(vehicle.location_state))
    return false;

  return true;
}
