import { toast } from "sonner";

export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, any>;
  created_at: string;
  dealer_id: string;
}

const STORAGE_KEY = "dh_filter_presets";

/**
 * Get all filter presets from localStorage
 */
export function getFilterPresets(dealerId: string): FilterPreset[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${dealerId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a new filter preset
 */
export function saveFilterPreset(
  name: string,
  filters: Record<string, any>,
  dealerId: string,
): FilterPreset {
  const preset: FilterPreset = {
    id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    filters,
    created_at: new Date().toISOString(),
    dealer_id: dealerId,
  };

  const presets = getFilterPresets(dealerId);
  presets.push(preset);

  localStorage.setItem(`${STORAGE_KEY}_${dealerId}`, JSON.stringify(presets));
  toast.success(`Filter preset "${name}" saved`);

  return preset;
}

/**
 * Delete a filter preset
 */
export function deleteFilterPreset(
  presetId: string,
  dealerId: string,
): boolean {
  const presets = getFilterPresets(dealerId);
  const filtered = presets.filter((p) => p.id !== presetId);

  if (filtered.length < presets.length) {
    localStorage.setItem(
      `${STORAGE_KEY}_${dealerId}`,
      JSON.stringify(filtered),
    );
    toast.success("Filter preset deleted");
    return true;
  }

  return false;
}

/**
 * Apply a filter preset
 */
export function applyFilterPreset(
  presetId: string,
  dealerId: string,
  setFilters: (filters: Record<string, any>) => void,
): boolean {
  const presets = getFilterPresets(dealerId);
  const preset = presets.find((p) => p.id === presetId);

  if (preset) {
    setFilters(preset.filters);
    toast.success(`Applied filter preset "${preset.name}"`);
    return true;
  }

  toast.error("Filter preset not found");
  return false;
}

/**
 * Default filter presets
 */
export const DEFAULT_PRESETS: Omit<
  FilterPreset,
  "id" | "created_at" | "dealer_id"
>[] = [
  {
    name: "Profitable Only",
    filters: {
      minProfit: 2000,
      sort: "profit",
    },
  },
  {
    name: "Local Deals",
    filters: {
      state: "local", // Will be replaced with user's state
      maxDistance: 100,
    },
  },
  {
    name: "Clean Title Only",
    filters: {
      titleType: "clean",
      excludeSalvage: true,
    },
  },
  {
    name: "High Value",
    filters: {
      minPrice: 10000,
      maxPrice: 50000,
      titleType: "clean",
    },
  },
  {
    name: "Quick Flips",
    filters: {
      maxPrice: 5000,
      minProfit: 1000,
      titleType: "all",
      sort: "profit",
    },
  },
  {
    name: "Parts Cars",
    filters: {
      titleType: "salvage",
      maxPrice: 3000,
      condition: "parts_only",
    },
  },
];

/**
 * Initialize default presets for a new user
 */
export function initializeDefaultPresets(dealerId: string, userState?: string) {
  const existing = getFilterPresets(dealerId);

  if (existing.length === 0) {
    DEFAULT_PRESETS.forEach((preset) => {
      const filters = { ...preset.filters };

      // Replace 'local' with user's actual state
      if (filters.state === "local" && userState) {
        filters.state = userState;
      }

      saveFilterPreset(preset.name, filters, dealerId);
    });

    toast.success("Default filter presets created");
  }
}
