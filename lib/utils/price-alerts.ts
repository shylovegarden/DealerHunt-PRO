import { toast } from "sonner";

export interface PriceAlert {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  original_price: number;
  current_price: number;
  price_change: number;
  price_change_percent: number;
  alert_type: "drop" | "increase";
  created_at: string;
}

/**
 * Check for price changes and show alerts
 */
export async function checkPriceAlerts(
  dealerId: string,
): Promise<PriceAlert[]> {
  try {
    const response = await fetch(`/api/price-alerts?dealerId=${dealerId}`);
    const data = await response.json();

    if (data.alerts && data.alerts.length > 0) {
      // Show toast for each significant price drop
      data.alerts.forEach((alert: PriceAlert) => {
        if (
          alert.alert_type === "drop" &&
          Math.abs(alert.price_change_percent) >= 5
        ) {
          toast.success(`💰 Price Drop Alert: ${alert.vehicle_name}`, {
            description: `Down ${alert.price_change_percent.toFixed(1)}% ($${Math.abs(alert.price_change).toLocaleString()})`,
            duration: 8000,
          });
        }
      });
    }

    return data.alerts || [];
  } catch (error) {
    console.error("Failed to check price alerts:", error);
    return [];
  }
}

/**
 * Create a price alert for a vehicle
 */
export async function createPriceAlert(
  vehicleId: string,
  vehicleName: string,
  currentPrice: number,
  dealerId: string,
  thresholdPercent: number = 5,
): Promise<boolean> {
  try {
    const response = await fetch("/api/price-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        vehicle_name: vehicleName,
        current_price: currentPrice,
        dealer_id: dealerId,
        threshold_percent: thresholdPercent,
      }),
    });

    const data = await response.json();

    if (data.success) {
      toast.success(`Price alert created for ${vehicleName}`);
      return true;
    } else {
      toast.error(`Failed to create alert: ${data.error}`);
      return false;
    }
  } catch (error: any) {
    toast.error(`Error: ${error.message}`);
    return false;
  }
}

/**
 * Delete a price alert
 */
export async function deletePriceAlert(alertId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/price-alerts/${alertId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      toast.success("Price alert deleted");
      return true;
    } else {
      toast.error("Failed to delete alert");
      return false;
    }
  } catch (error: any) {
    toast.error(`Error: ${error.message}`);
    return false;
  }
}

/**
 * Get all active price alerts for a dealer
 */
export async function getPriceAlerts(dealerId: string): Promise<PriceAlert[]> {
  try {
    const response = await fetch(`/api/price-alerts?dealerId=${dealerId}`);
    const data = await response.json();
    return data.alerts || [];
  } catch (error) {
    console.error("Failed to get price alerts:", error);
    return [];
  }
}

/**
 * Hook to automatically check for price alerts on interval
 */
export function usePriceAlerts(
  dealerId: string | null,
  intervalMs: number = 300000,
) {
  if (typeof window === "undefined") return;

  const check = () => {
    if (dealerId) {
      checkPriceAlerts(dealerId);
    }
  };

  // Check immediately
  check();

  // Check on interval (default 5 minutes)
  const interval = setInterval(check, intervalMs);

  return () => clearInterval(interval);
}
