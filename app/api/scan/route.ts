import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase env not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}
const supabase = createClient(supabaseUrl, supabaseKey);

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(r: any, table: "deals" | "vehicles") {
  // Map both deals and vehicles rows into a Deal-like shape used by scan UI mapper
  const id = r.id;
  const source = r.source || "unknown";
  const year = r.year ?? undefined;
  const make = r.make || "";
  const model = r.model || "";
  const mileage = r.mileage ?? r.miles ?? undefined;
  const askPrice = toNum(r.ask_price ?? r.askPrice ?? 0);
  const mmrValue = toNum(r.mmr_value ?? r.mmrValue ?? r.market_value ?? 0);
  const profitEstimate = toNum(r.profit_estimate ?? r.profitEstimate ?? 0);
  const profitScore = r.profit_score ?? r.profitScore ?? undefined;
  const condition = r.condition || "";
  const damageType = r.damage_type || r.damageType || undefined;
  const locationCity = r.location_city || r.locationCity || undefined;
  const locationState = r.location_state || r.locationState || undefined;
  const seller = r.seller || undefined;
  const auctionEndAt =
    r.auction_end || r.auction_end_at || r.auctionEndAt || undefined;
  const repairEst = toNum(r.repair_estimate ?? r.repairEst ?? 0);
  const images = Array.isArray(r.images) ? r.images : r.images || [];
  return {
    id,
    source,
    title: r.title || `${year || ""} ${make} ${model}`.trim(),
    year,
    make,
    model,
    trim: r.trim,
    bodyClass: r.body_class || undefined,
    recallsCount: r.recalls_count ?? undefined,
    assemblyCountry: r.assembly_country || undefined,
    vin: r.vin,
    mileage,
    condition,
    askPrice,
    buyNowPrice: r.buy_now_price ?? undefined,
    mmrValue,
    profitEstimate,
    profitScore: profitScore != null ? Number(profitScore) : undefined,
    // Decision-engine fields — must be carried through so verdict pills / max-bid /
    // resale render on the Scan grid (mapDealToResult reads these camelCase keys).
    dealVerdict: r.deal_verdict || undefined,
    recommendedMaxBid:
      r.recommended_max_bid != null ? Number(r.recommended_max_bid) : undefined,
    sellEstimate: r.sell_estimate != null ? Number(r.sell_estimate) : undefined,
    true_net_profit:
      r.true_net_profit != null ? Number(r.true_net_profit) : undefined,
    images,
    locationCity,
    locationState,
    locationZip: r.location_zip || undefined,
    active: r.active ?? true,
    firstSeenAt: r.first_seen_at ? new Date(r.first_seen_at) : new Date(),
    lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at) : new Date(),
    sourceUrl: r.source_url || r.sourceUrl || "",
    auctionEndAt: auctionEndAt ? new Date(auctionEndAt) : undefined,
    damageType,
    seller,
    sellerType: r.seller_type || undefined,
    repair_estimate: repairEst || undefined,
    transport_cost: r.transport_cost ?? undefined,
    is_arbitrage_opportunity: r.is_arbitrage_opportunity ?? undefined,
  };
}

function dedupeKey(r: any) {
  return `${(r.source || "unknown").toLowerCase()}::${r.source_deal_id || r.id || r.vin || ""}`;
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { key: "scan", limit: 90, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequests(rl) as any;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const state = searchParams.get("state") || "";
  const make = searchParams.get("make") || "";
  const source = searchParams.get("source") || "";
  const titleType = searchParams.get("titleType") || "";
  const category = searchParams.get("cat") || "";
  const minProfit = parseInt(searchParams.get("minProfit") || "0");
  // Range filters — remove the "borders" so any buyer can scope by era, budget, and odometer.
  const minYear = parseInt(searchParams.get("minYear") || "0");
  const maxYear = parseInt(searchParams.get("maxYear") || "0");
  const maxPrice = parseInt(searchParams.get("maxPrice") || "0");
  const minPrice = parseInt(searchParams.get("minPrice") || "0");
  const verdict = searchParams.get("verdict") || "";
  const minMileage = parseInt(searchParams.get("minMileage") || "0");
  const maxMileage = parseInt(searchParams.get("maxMileage") || "0");
  const availability = searchParams.get("availability") || "";
  const madeInUsa = searchParams.get("madeInUsa") === "1";
  const drivetrain = searchParams.get("drivetrain") || "";
  const page = parseInt(searchParams.get("page") || "0");
  const pageSize = 20;

  let query = supabase.from("deals").select("*", { count: "exact" });

  if (make) {
    query = query.ilike("make", make);
  }

  if (availability) {
    query = query.eq("availability_status", availability);
  }

  if (madeInUsa) {
    // NHTSA returns assembly country like "UNITED STATES (USA)".
    query = query.or(
      "assembly_country.ilike.%united states%,assembly_country.ilike.%usa%",
    );
  }

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,vin.ilike.%${q}%`,
    );
  }

  // Drivetrain facet from the parsed options JSONB (AWD / 4WD / FWD / RWD).
  if (drivetrain && drivetrain !== "all") {
    query = query.eq("options->>drivetrain", drivetrain);
  }

  if (verdict && verdict !== "all") query = query.eq("deal_verdict", verdict);
  if (minYear > 0) query = query.gte("year", minYear);
  if (maxYear > 0) query = query.lte("year", maxYear);
  if (maxPrice > 0) query = query.lte("ask_price", maxPrice);
  if (minPrice > 0) query = query.gte("ask_price", minPrice);
  // Mileage may be null on some rows; range filters naturally exclude nulls, which is acceptable
  // for an explicit mileage search.
  if (minMileage > 0) query = query.gte("mileage", minMileage);
  if (maxMileage > 0) query = query.lte("mileage", maxMileage);

  if (source) {
    query = query.eq("source", source.toLowerCase());
  }

  if (titleType && titleType !== "all") {
    const conditionMapping: Record<string, string> = {
      clean: "clean_title",
      rebuilt: "rebuilt_title",
      salvage: "salvage_title",
      parts: "parts_only",
    };
    const mappedCondition = conditionMapping[titleType] || titleType;
    query = query.eq("condition", mappedCondition);
  }

  if (category && !source && !titleType) {
    const cleanCat = category.toLowerCase();
    if (
      ["copart", "iaa", "craigslist", "ebay", "facebook"].includes(cleanCat)
    ) {
      const sourceMapping: Record<string, string> = {
        facebook: "facebook_marketplace",
        ebay: "ebay_motors",
      };
      query = query.eq("source", sourceMapping[cleanCat] || cleanCat);
    } else {
      query = query.eq("condition", cleanCat);
    }
  }

  if (minProfit > 0) {
    query = query.gte("profit_estimate", minProfit);
  }

  query = query
    .order("profit_score", { ascending: false, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error("API scan error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dRows = (data || []).map((r: any) => normalizeRow(r, "deals"));

  // State boost: sort state-match results first
  const sorted = state
    ? [
        ...dRows.filter(
          (v: any) =>
            (v.locationState || "").toUpperCase() === state.toUpperCase(),
        ),
        ...dRows.filter(
          (v: any) =>
            (v.locationState || "").toUpperCase() !== state.toUpperCase(),
        ),
      ]
    : dRows;

  return NextResponse.json({
    vehicles: sorted,
    total: count || 0,
    state: state || "nationwide",
    page,
    pageSize,
    hasMore: (count || 0) > (page + 1) * pageSize,
    isLive: true,
  });
}

// POST — trigger a new scan
// The legacy BullMQ "scrape" queue has been removed; scraping is now handled by the
// GitHub Actions ingestion pipeline (or by the AI parsing queue when a user saves a
// specific URL). This endpoint remains so the UI can signal a refresh, but the actual
// live results come from the deals table via the GET endpoint above.
export async function POST(req: NextRequest) {
  try {
    const { searchTerm } = await req.json();

    if (!searchTerm) {
      return NextResponse.json(
        { error: "searchTerm is required" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Live scanner is active. Results for "${searchTerm}" stream in automatically as the pipeline finds new deals.`,
    });
  } catch (error: any) {
    console.error("Scan trigger error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
