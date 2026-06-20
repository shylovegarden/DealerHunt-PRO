export interface DamageType {
  value: string
  label: string
  repair: number
}

export const DAMAGE_TYPES: DamageType[] = [
  { value: 'clean', label: 'Clean — No Damage', repair: 0 },
  { value: 'minor', label: 'Minor Dents / Scratches', repair: 900 },
  { value: 'hail_mod', label: 'Hail — Moderate', repair: 2500 },
  { value: 'hail_sev', label: 'Hail — Severe', repair: 7000 },
  { value: 'front', label: 'Front Collision', repair: 3500 },
  { value: 'rear', label: 'Rear Collision', repair: 2000 },
  { value: 'side', label: 'Side Impact', repair: 5500 },
  { value: 'frame', label: 'Frame / Structural', repair: 9000 },
  { value: 'flood_mild', label: 'Flood — Mild', repair: 2000 },
  { value: 'flood_sev', label: 'Flood — Submerged', repair: 10000 },
  { value: 'fire', label: 'Fire Damage', repair: 8500 },
  { value: 'engine', label: 'Engine Replacement', repair: 4500 },
  { value: 'transmission', label: 'Transmission', repair: 3000 },
  { value: 'airbags', label: 'Airbags Deployed', repair: 2500 },
  { value: 'catalytic', label: 'Catalytic Converter', repair: 1500 },
  { value: 'windshield', label: 'Windshield + ADAS', repair: 500 },
]
