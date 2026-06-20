import { decodeVIN } from '../api/vin';

export async function checkRecallsOnFleetAdd(vin: string) {
  const vinData = await decodeVIN(vin);
  if ((vinData?.recallCount || 0) > 0) {
    return {
      hasRecalls: true,
      count: vinData?.recallCount,
      recalls: vinData?.recalls,
      warning: `⚠️ This vehicle has ${vinData?.recallCount} open NHTSA recall(s). Check dealer is aware before resale.`
    };
  }
  return { hasRecalls: false };
}
