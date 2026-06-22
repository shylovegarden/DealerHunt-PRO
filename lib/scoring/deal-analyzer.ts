// lib/scoring/deal-analyzer.ts
// Turns a scraped deal into a full buy/sell/repair/profit decision using the comprehensive
// calculateProfit model — replacing the naive "ask × markup" scorer in the live pipeline.
//
// It computes, per deal:
//   • BUY  — bid + realistic auction buyer fees + title fee
//   • REPAIR — from damage_type (+ recon for salvage-auction sources)
//   • TRANSPORT — distance from the listing's state to your home base × carrier rate
//   • SELL — market value (mmr/comps) when known, else a source/condition-aware markup
//   • PROFIT/ROI/score/verdict + a recommended MAX BID to hit a target ROI

import { Deal } from "@/types";
import { calculateProfit, type ProfitResult } from "./profit-calculator";
import { milesBetweenStates, transportCostForMiles } from "@/lib/geo";
import { lookupMarketValue, lookupMarketAggregate } from "./market-value";

// Home base used for transport-distance math (where you recondition/sell). Override via env.
const HOME_BASE_STATE = process.env.HOME_BASE_STATE || "TX";
// Target ROI used to back-solve the recommended max bid (e.g. 0.20 = 20%).
const TARGET_ROI = parseFloat(process.env.TARGET_ROI || "0.20");
// Selling + reconditioning-to-retail load, as a fraction of sale price (real flips run ~8-10%).
const SELL_COST_PCT = parseFloat(process.env.SELL_COST_PCT || "0.09");
// Conservative national-average tow when the listing has no usable location (miles unknown).
const DEFAULT_TRANSPORT_COST = parseFloat(
  process.env.DEFAULT_TRANSPORT_COST || "600",
);

// Map a private/retail condition (when no damage_type is present) to a recon/repair baseline,
// so obviously-damaged private cars don't book $0 repair.
function conditionRepairBaseline(condition?: string): number {
  const c = (condition || "").toLowerCase();
  if (!c) return 0;
  if (
    c.includes("salvage") ||
    c.includes("rebuilt") ||
    c.includes("repairable") ||
    c.includes("parts")
  )
    return 2500;
  if (c.includes("run_drive") || c.includes("run/drive")) return 1500;
  if (
    c.includes("used") ||
    c.includes("clean") ||
    c.includes("fair") ||
    c.includes("good")
  )
    return 400;
  return 0;
}

// Cheap, deterministic body-type demand + seasonality signal so the score adapts per
// vehicle/season instead of staying a flat constant. No DB calls.
function marketSignals(
  make?: string,
  model?: string,
  month?: number,
): {
  demand: number; // 0-10
  velocity: number; // 0-10
  seasonality: number; // 0-5
  competition: number; // 0-5
} {
  const mm = `${make || ""} ${model || ""}`.toLowerCase();
  const m = month ?? new Date().getMonth() + 1; // 1-12

  const isTruckSuv =
    /\b(silverado|sierra|f-?150|f-?250|f-?350|ram|tundra|tacoma|titan|frontier|ranger|colorado|canyon)\b/.test(
      mm,
    ) ||
    /\b(tahoe|suburban|yukon|expedition|explorer|wrangler|4runner|highlander|pilot|telluride|palisade|grand ?cherokee|durango|sequoia|bronco|escalade)\b/.test(
      mm,
    ) ||
    /\b(suv|truck|pickup|4wd|awd)\b/.test(mm);
  const isConvertible = /\b(convertible|roadster|spyder|cabriolet)\b/.test(mm);
  const isSports =
    /\b(corvette|mustang|camaro|challenger|charger|porsche|ferrari|gt-?r|supra|miata|m3|m4)\b/.test(
      mm,
    );

  // Demand (0-10): trucks/SUVs move fastest; sports moderate; convertibles softer.
  let demand = 5;
  if (isTruckSuv) demand = 8;
  else if (isSports) demand = 6;
  else if (isConvertible) demand = 4;

  // Seasonality (0-5): trucks/SUVs peak in winter; convertibles/sports peak in spring/summer.
  let seasonality = 3;
  if (isTruckSuv)
    seasonality = m >= 10 || m <= 2 ? 5 : m >= 3 && m <= 5 ? 3 : 2;
  else if (isConvertible || isSports) seasonality = m >= 4 && m <= 8 ? 5 : 2;

  // Velocity/competition kept neutral-ish but tied to body type (deterministic, cheap).
  const velocity = isTruckSuv ? 6 : 5;
  const competition = isTruckSuv ? 4 : 3;

  return { demand, velocity, seasonality, competition };
}

interface FeeModel {
  feeRate: number; // % of bid charged as buyer premium
  flatFee: number; // flat auction/bid fees
  titleFee: number;
  reconCost: number; // baseline cleanup/keys/detailing for the source type
}

// Realistic-enough acquisition cost model per source (auction fees are otherwise ignored).
function feeModel(source?: string): FeeModel {
  const s = (source || "").toLowerCase();
  if (s === "copart" || s === "iaa")
    return { feeRate: 0.1, flatFee: 130, titleFee: 100, reconCost: 500 };
  if (s === "manheim" || s === "adesa" || s === "acv")
    return { feeRate: 0.0, flatFee: 600, titleFee: 100, reconCost: 300 };
  // Private party / retail marketplaces — no buyer premium.
  return { feeRate: 0, flatFee: 0, titleFee: 0, reconCost: 0 };
}

// Fallback sell value when no market/MMR number is available: source/condition-aware markup on ask.
function estimateSellValue(
  askPrice: number,
  source?: string,
  condition?: string,
): number {
  const c = (condition || "").toLowerCase();
  const s = (source || "").toLowerCase();
  let markup = 1.25;
  if (c.includes("salvage") || c.includes("parts")) markup = 1.35;
  else if (s === "copart" || s === "iaa") markup = 1.3;
  else if (s === "manheim" || s === "adesa" || s === "acv") markup = 1.2;
  else if (
    s === "craigslist" ||
    s === "facebook_marketplace" ||
    s === "offerup"
  )
    markup = 1.15;
  return Math.round(askPrice * markup);
}

export interface DealAnalysis extends ProfitResult {
  sellEstimate: number;
  sellBasis: "comps" | "market" | "markup";
  recommendedMaxBid: number;
  miles: number | null;
}

/** Run the full decision model for one deal. */
export function analyzeDeal(deal: Partial<Deal>): DealAnalysis {
  const askPrice = deal.ask_price || 0;
  const fm = feeModel(deal.source);

  // SELL side, in order of trust:
  //  1. real retail comps from our own scraped data (lib/scoring/market-value.ts)
  //  2. a market value already attached to the deal (mmr_value, e.g. from MarketCheck/VIN)
  //  3. the nightly market_aggregates rollup — accumulated history that compounds as we scrape
  //  4. a source/condition markup on ask (fallback)
  const comps = lookupMarketValue(deal.make, deal.model, deal.year);
  const hasMarket = typeof deal.mmr_value === "number" && deal.mmr_value > 0;
  const aggregate =
    comps?.retail || hasMarket
      ? null
      : lookupMarketAggregate(deal.make, deal.model, deal.year);
  let sellEstimate: number;
  let sellBasis: "comps" | "market" | "markup";
  if (comps?.retail) {
    sellEstimate = comps.retail;
    sellBasis = "comps";
  } else if (hasMarket) {
    sellEstimate = deal.mmr_value as number;
    sellBasis = "market";
  } else if (aggregate && aggregate.value > 0) {
    // Accumulated nightly history — treated as a market value (avg of mmr), same tier as #2.
    sellEstimate = aggregate.value;
    sellBasis = "market";
  } else {
    sellEstimate = estimateSellValue(askPrice, deal.source, deal.condition);
    sellBasis = "markup";
  }

  // TRANSPORT: listing state → home base. When location is missing (miles null), don't
  // book $0 — use a conservative national-average so deals aren't falsely cheap to move.
  const miles = milesBetweenStates(
    deal.location_state || undefined,
    HOME_BASE_STATE,
  );
  const transportCost =
    miles != null ? transportCostForMiles(miles) : DEFAULT_TRANSPORT_COST;

  const auctionFee = Math.round(askPrice * fm.feeRate + fm.flatFee);

  // REPAIR: auction sources carry damage_type; private/retail sources carry only a condition.
  // When damage_type is absent, derive a recon/repair baseline from condition so damaged
  // private cars aren't scored as $0-repair. Pass it as an explicit repairCost override.
  const hasDamageType = !!(
    deal.damage_type &&
    deal.damage_type.trim() &&
    deal.damage_type.toLowerCase() !== "none"
  );
  const conditionRepair = hasDamageType
    ? undefined
    : conditionRepairBaseline(deal.condition);

  // SELLING + recon-to-retail load (~9% of sale), so profit isn't overstated.
  const sellingFee = Math.round(sellEstimate * SELL_COST_PCT);

  // Cheap, deterministic market-intelligence signals so the score adapts by vehicle/season.
  const signals = marketSignals(deal.make, deal.model);

  const result = calculateProfit({
    askPrice,
    auctionFee,
    titleFee: fm.titleFee,
    damageType: deal.damage_type || undefined,
    repairCost: conditionRepair,
    reconCost: fm.reconCost,
    miles: miles ?? undefined,
    transportCost,
    salePrice: sellEstimate,
    sellingFee,
    // Feed a trusted market value into the risk model (comps or attached market value, not the markup guess).
    mmrValue: sellBasis === "markup" ? undefined : sellEstimate,
    make: deal.make || undefined,
    model: deal.model || undefined,
    marketDemandScore: signals.demand,
    marketVelocityScore: signals.velocity,
    seasonalityScore: signals.seasonality,
    competitionScore: signals.competition,
  });

  // Recommended MAX BID to achieve TARGET_ROI, holding non-acquisition costs fixed.
  // totalCost = acquisition + (repair + transport + holding + selling); acquisition = bid*(1+feeRate) + flatFee + titleFee
  // require (sell - totalCost)/totalCost >= TARGET_ROI  →  maxTotal = sell / (1+TARGET_ROI)
  const fixedNonAcq =
    result.repairCost +
    result.transportCost +
    result.holdingCost +
    result.sellingCost;
  const maxTotal = sellEstimate / (1 + TARGET_ROI);
  const maxAcquisition = maxTotal - fixedNonAcq;
  const recommendedMaxBid = Math.max(
    0,
    Math.round((maxAcquisition - fm.flatFee - fm.titleFee) / (1 + fm.feeRate)),
  );

  return { ...result, sellEstimate, sellBasis, recommendedMaxBid, miles };
}
