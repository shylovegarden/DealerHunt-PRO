import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { upsertProperties, queryProperties, propertyStats } from "./store";
import type { Property } from "./types";

// Mock Supabase client
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock geocoding
vi.mock("@/lib/geo/geocode", () => ({
  resolvePlaces: vi.fn(async () => new Map()),
  placeKey: vi.fn(() => "testkey"),
}));

// Mock lead scoring
vi.mock("./lead-score", () => ({
  scoreHousingLead: vi.fn((p: Property) => ({
    score: 75,
    tier: "warm",
    signals: ["below_market"],
  })),
}));

describe("upsertProperties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful chain
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("should return 0 for empty array", async () => {
    const result = await upsertProperties([]);
    expect(result).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should filter out properties without source_listing_id", async () => {
    const properties: Property[] = [
      {
        source: "test",
        source_listing_id: "",
        source_url: "http://test.com",
        title: "No ID Property",
        property_type: "single_family",
        address: "123 Main",
        city: "Boston",
        state: "MA",
        price: 100000,
      } as Property,
    ];

    const result = await upsertProperties(properties);
    expect(result).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should successfully upsert valid properties", async () => {
    const properties: Property[] = [
      {
        source: "govdeals",
        source_listing_id: "12345",
        source_url: "http://test.com/12345",
        title: "Test Property",
        property_type: "single_family",
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zip: "02101",
        price: 250000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        images: ["http://test.com/img1.jpg"],
      } as Property,
    ];

    const result = await upsertProperties(properties);
    expect(result).toBe(1);
    expect(mockFrom).toHaveBeenCalledWith("properties");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          source: "govdeals",
          source_listing_id: "12345",
          title: "Test Property",
          lead_score: 75,
          lead_tier: "warm",
          active: true,
        }),
      ]),
      { onConflict: "source,source_listing_id" },
    );
  });

  it("should return -1 when properties table does not exist", async () => {
    mockUpsert.mockResolvedValue({
      error: { message: "relation properties does not exist" },
    });

    const properties: Property[] = [
      {
        source: "test",
        source_listing_id: "123",
        source_url: "http://test.com",
        title: "Test",
        property_type: "single_family",
        address: "123 Main",
        city: "Boston",
        state: "MA",
        price: 100000,
      } as Property,
    ];

    const result = await upsertProperties(properties);
    expect(result).toBe(-1);
  });

  it("should self-heal by removing unknown columns", async () => {
    let callCount = 0;
    // First call fails with unknown column mentioning a field in our row
    mockUpsert.mockImplementation(async (rows) => {
      callCount++;
      if (callCount === 1) {
        // First call - error mentions "lead_score" which exists in row
        return { error: { message: 'column "lead_score" does not exist' } };
      }
      // Second call - success
      return { error: null };
    });

    const properties: Property[] = [
      {
        source: "test",
        source_listing_id: "123",
        source_url: "http://test.com",
        title: "Test",
        property_type: "single_family",
        address: "123 Main",
        city: "Boston",
        state: "MA",
        price: 100000,
      } as Property,
    ];

    const result = await upsertProperties(properties);
    expect(result).toBe(1);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("should handle geocoding errors gracefully", async () => {
    const { resolvePlaces } = await import("@/lib/geo/geocode");
    vi.mocked(resolvePlaces).mockRejectedValueOnce(
      new Error("Geocoding failed"),
    );

    const properties: Property[] = [
      {
        source: "test",
        source_listing_id: "123",
        source_url: "http://test.com",
        title: "Test",
        property_type: "single_family",
        address: "123 Main",
        city: "Boston",
        state: "MA",
        price: 100000,
      } as Property,
    ];

    const result = await upsertProperties(properties);
    expect(result).toBe(1); // Should still succeed despite geocoding failure
  });

  it("should include all required fields in row transformation", async () => {
    const properties: Property[] = [
      {
        source: "govdeals",
        source_listing_id: "12345",
        source_url: "http://test.com/12345",
        title: "Complete Property",
        property_type: "land",
        description: "Test description",
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zip: "02101",
        lat: 42.3601,
        lng: -71.0589,
        price: 250000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        lot_size_acres: 0.5,
        year_built: 1990,
        images: ["http://test.com/img1.jpg"],
        seller: "City of Boston",
        seller_type: "gov",
        auction_end: "2026-07-01T00:00:00Z",
        bid_count: 5,
        scraped_at: "2026-06-28T00:00:00Z",
      } as Property,
    ];

    await upsertProperties(properties);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          source: "govdeals",
          source_listing_id: "12345",
          source_url: "http://test.com/12345",
          title: "Complete Property",
          property_type: "land",
          description: "Test description",
          address: "123 Main St",
          city: "Boston",
          state: "MA",
          zip: "02101",
          lat: 42.3601,
          lng: -71.0589,
          price: 250000,
          beds: 3,
          baths: 2,
          sqft: 1500,
          lot_size_acres: 0.5,
          year_built: 1990,
          seller: "City of Boston",
          seller_type: "gov",
          auction_end: "2026-07-01T00:00:00Z",
          bid_count: 5,
          lead_score: 75,
          lead_tier: "warm",
          active: true,
          scraped_at: "2026-06-28T00:00:00Z",
        }),
      ]),
      expect.any(Object),
    );
  });
});

describe("queryProperties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default query chain - need to return objects with all methods for chaining
    const chainMethods = {
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      gte: mockGte,
    };
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue(chainMethods);
    mockEq.mockReturnValue(chainMethods);
    mockOrder.mockReturnValue(chainMethods);
    mockLimit.mockReturnValue({ data: [], error: null });
    mockGte.mockReturnValue(chainMethods);
  });

  it("should return null when table does not exist", async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { message: "relation properties does not exist" },
    });

    const result = await queryProperties();
    expect(result).toBeNull();
  });

  it("should return empty array when no properties found", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    const result = await queryProperties();
    expect(result).toEqual([]);
  });

  it("should return properties ordered by lead_score desc", async () => {
    const mockData = [
      {
        id: "1",
        source: "govdeals",
        title: "Hot Property",
        lead_score: 95,
        lead_tier: "hot",
      },
      {
        id: "2",
        source: "govdeals",
        title: "Warm Property",
        lead_score: 75,
        lead_tier: "warm",
      },
    ];
    mockLimit.mockResolvedValue({ data: mockData, error: null });

    const result = await queryProperties();
    expect(result).toEqual(mockData);
    expect(mockOrder).toHaveBeenCalledWith("lead_score", {
      ascending: false,
      nullsFirst: false,
    });
  });

  it("should filter by state when provided", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await queryProperties({ state: "ma" });
    expect(mockEq).toHaveBeenCalledWith("state", "MA"); // Should uppercase
  });

  it("should filter by tier when provided", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await queryProperties({ tier: "hot" });
    expect(mockEq).toHaveBeenCalledWith("lead_tier", "hot");
  });

  it("should filter by source when provided", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await queryProperties({ source: "govdeals" });
    expect(mockEq).toHaveBeenCalledWith("source", "govdeals");
  });

  it("should filter by minScore when provided", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await queryProperties({ minScore: 80 });
    expect(mockGte).toHaveBeenCalledWith("lead_score", 80);
  });

  it("should respect limit parameter with max of 2000", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await queryProperties({ limit: 5000 });
    expect(mockLimit).toHaveBeenCalledWith(2000); // Capped at 2000 (raised for the country/state views)
  });

  it("should use default limit of 200", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await queryProperties();
    expect(mockLimit).toHaveBeenCalledWith(200);
  });

  it("should allow smaller custom limits", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await queryProperties({ limit: 50 });
    expect(mockLimit).toHaveBeenCalledWith(50);
  });
});

describe("propertyStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
  });

  it("should return null when store is unavailable", async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { message: "table does not exist" },
    });

    const result = await propertyStats();
    expect(result).toBeNull();
  });

  it("should return zero counts for empty store", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    const result = await propertyStats();
    expect(result).toEqual({
      total: 0,
      byTier: { hot: 0, warm: 0, standard: 0 },
      byState: {},
    });
  });

  it("should count properties by tier", async () => {
    const mockData = [
      { lead_tier: "hot", state: "MA" },
      { lead_tier: "hot", state: "MA" },
      { lead_tier: "warm", state: "CA" },
      { lead_tier: "standard", state: "NY" },
    ];
    mockLimit.mockResolvedValue({ data: mockData, error: null });

    const result = await propertyStats();
    expect(result?.byTier).toEqual({
      hot: 2,
      warm: 1,
      standard: 1,
    });
  });

  it("should count properties by state", async () => {
    const mockData = [
      { lead_tier: "hot", state: "MA" },
      { lead_tier: "warm", state: "MA" },
      { lead_tier: "hot", state: "CA" },
      { lead_tier: "standard", state: "NY" },
    ];
    mockLimit.mockResolvedValue({ data: mockData, error: null });

    const result = await propertyStats();
    expect(result?.byState).toEqual({
      MA: 2,
      CA: 1,
      NY: 1,
    });
  });

  it("should return correct total count", async () => {
    const mockData = [
      { lead_tier: "hot", state: "MA" },
      { lead_tier: "warm", state: "CA" },
      { lead_tier: "standard", state: "NY" },
    ];
    mockLimit.mockResolvedValue({ data: mockData, error: null });

    const result = await propertyStats();
    expect(result?.total).toBe(3);
  });

  it("should handle properties with missing tier or state", async () => {
    const mockData = [
      { lead_tier: "hot", state: "MA" },
      { lead_tier: null, state: "CA" },
      { lead_tier: "warm", state: null },
      { lead_tier: null, state: null },
    ];
    mockLimit.mockResolvedValue({ data: mockData, error: null });

    const result = await propertyStats();
    expect(result?.total).toBe(4);
    expect(result?.byTier.hot).toBe(1);
    expect(result?.byTier.warm).toBe(1);
    expect(result?.byState.MA).toBe(1);
    expect(result?.byState.CA).toBe(1);
  });
});
