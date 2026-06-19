export interface DecodedVIN {
  make: string;
  model: string;
  year: number;
  engine: string;
  bodyStyle: string;
  driveType: string;
  fuelType: string;
}

/**
 * Uses the 100% free US Government NHTSA vPIC API to decode VINs.
 * This completely eliminates the need for expensive enterprise VIN APIs.
 */
export async function decodeVIN(vin: string): Promise<DecodedVIN | null> {
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`);
    const data = await response.json();
    
    if (!data.Results || data.Results.length === 0) return null;
    
    const result = data.Results[0];
    
    // Check if the VIN was actually valid (NHTSA returns error codes in ErrorCode field)
    if (result.ErrorCode && result.ErrorCode !== '0' && !result.ErrorCode.includes('0 - VIN decoded clean')) {
      // Some error codes are just warnings, but if Make is empty it's a real failure
      if (!result.Make) {
        console.warn(`[NHTSA] VIN Decode warning for ${vin}: ${result.ErrorCode}`);
        return null;
      }
    }
    
    return {
      make: result.Make,
      model: result.Model,
      year: parseInt(result.ModelYear, 10),
      engine: `${result.EngineConfiguration} ${result.EngineCylinders} Cyl ${result.DisplacementL}L`.trim(),
      bodyStyle: result.BodyClass,
      driveType: result.DriveType,
      fuelType: result.FuelTypePrimary
    };
  } catch (error) {
    console.error('[NHTSA] Failed to decode VIN:', error);
    return null;
  }
}
