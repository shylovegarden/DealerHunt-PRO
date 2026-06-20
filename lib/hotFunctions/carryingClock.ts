export function getCarryingCost(unit: {
  floor_date: string;
  daily_floor_rate: number;
  list_price: number;
  total_cost: number;
}) {
  const days = Math.floor((Date.now() - new Date(unit.floor_date).getTime()) / 86400000);
  const totalCarrying = days * unit.daily_floor_rate;
  const grossProfit = unit.list_price - unit.total_cost;
  const breakEvenDay = Math.floor(grossProfit / unit.daily_floor_rate);
  const daysRemaining = Math.max(0, breakEvenDay - days);
  
  return {
    days,
    totalCarrying,
    breakEvenDay,
    daysRemaining,
    urgency: days >= breakEvenDay ? 'critical' : days >= breakEvenDay * 0.75 ? 'high' : days >= 15 ? 'medium' : 'low',
    message: days >= breakEvenDay
      ? `⚠️ PAST break-even. Every day costs $${unit.daily_floor_rate} with NO profit recovery.`
      : `${daysRemaining} days to break-even. $${totalCarrying.toLocaleString()} carrying so far.`,
  };
}
