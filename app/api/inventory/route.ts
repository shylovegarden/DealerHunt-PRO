export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { InventoryService } from "@/lib/data/inventory-service";
import {
  isSupabaseConfigured,
  createServerComponentClient,
} from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local",
      },
      { status: 503 },
    );
  }

  try {
    // Derive dealerId from authenticated session (server-side source of truth)
    const supabase = createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await getServerUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const dealerId = user.id;

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage")?.split(",").filter(Boolean) as any;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!, 10)
      : undefined;

    const inventoryService = new InventoryService();
    const result = await inventoryService.getInventory(dealerId, {
      stage,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in inventory API:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await getServerUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const dealerId = user.id;

    const body = await request.json();
    // Minimal required fields for acquisition from a deal
    const {
      vin = "",
      year = 0,
      make = "",
      model = "",
      trim,
      condition = "clean",
      purchasePrice = 0,
      auctionFee = 0,
      transportCost = 0,
      repairCost = 0,
      reconCost = 0,
      titleFee = 0,
      holdingCost = 0,
      otherCosts = 0,
      listPrice,
      marketValue,
      stage = "acquired",
      purchasedFrom,
      purchasedCity,
      purchasedState,
      notes,
      photos = [],
      listedPlatforms = [],
    } = body || {};

    const payload = {
      dealer_id: dealerId,
      vin,
      year,
      make,
      model,
      trim: trim || null,
      condition,
      purchase_price: purchasePrice,
      auction_fee: auctionFee,
      transport_cost: transportCost,
      repair_cost: repairCost,
      recon_cost: reconCost,
      title_fee: titleFee,
      holding_cost: holdingCost,
      other_costs: otherCosts,
      // total_cost is a GENERATED column — must not be inserted.
      list_price: listPrice ?? null,
      market_value: marketValue ?? null,
      stage,
      floor_date: new Date().toISOString(),
      daily_floor_rate: 35,
      photos,
      listed_platforms: listedPlatforms,
      purchased_from: purchasedFrom || null,
      purchased_city: purchasedCity || null,
      purchased_state: purchasedState || null,
      notes: notes || null,
      lead_count: 0,
    };

    const { data, error } = await supabase
      .from("inventory")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("Error creating inventory:", error);
    return NextResponse.json(
      { error: "Failed to create inventory" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await getServerUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const dealerId = user.id;

    const body = await request.json();
    const { id, stage, listed_platforms } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (!stage && !listed_platforms) {
      return NextResponse.json(
        { error: "stage or listed_platforms required" },
        { status: 400 },
      );
    }

    // Verify ownership before updating (ensure this inventory row belongs to the authenticated dealer)
    const { data: row, error: fetchErr } = await supabase
      .from("inventory")
      .select("id, dealer_id")
      .eq("id", id)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.dealer_id !== dealerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build update payload
    const update: any = {};
    if (stage) update.stage = stage;
    if (Array.isArray(listed_platforms))
      update.listed_platforms = listed_platforms;

    const { data, error: updErr } = await supabase
      .from("inventory")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const inventoryService = new InventoryService();
    const item = inventoryService["mapDbToItem"]
      ? inventoryService["mapDbToItem"](data)
      : data;

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      { error: "Failed to update inventory" },
      { status: 500 },
    );
  }
}
