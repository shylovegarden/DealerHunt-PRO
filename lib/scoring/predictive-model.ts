// lib/scoring/predictive-model.ts
// ─── Predictive Models for Price & Days-to-Sell ───────────────────────────────

import { createServerComponentClient } from "@/lib/supabase";

export interface PricePrediction {
  current_price: number;
  predicted_30_days: number;
  predicted_60_days: number;
  predicted_90_days: number;
  trend: "appreciating" | "stable" | "depreciating";
  confidence: number; // 0-100
}

export interface DaysToSellPrediction {
  predicted_days: number;
  confidence: number; // 0-100
  factors: {
    price_factor: number; // How price affects speed
    demand_factor: number; // How demand affects speed
    season_factor: number; // How seasonality affects speed
    condition_factor: number; // How condition affects speed
  };
}

export interface RiskAssessment {
  overall_risk: "low" | "medium" | "high";
  risk_score: number; // 0-100, lower is better
  risk_factors: {
    hidden_issues_risk: number; // 0-100
    transport_risk: number; // 0-100
    market_risk: number; // 0-100
    holding_risk: number; // 0-100
  };
  warnings: string[];
}

/**
 * Predict future price using linear regression on historical data
 */
export async function predictPrice(
  make: string,
  model: string,
  currentPrice: number,
): Promise<PricePrediction> {
  const supabase = createServerComponentClient();

  try {
    // Get historical trends (last 90 days)
    const { data: trends, error } = await supabase
      .from("market_trends")
      .select("avg_price, recorded_at")
      .ilike("make", make)
      .ilike("model", `%${model}%`)
      .gte(
        "recorded_at",
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("recorded_at", { ascending: true });

    if (error || !trends || trends.length < 3) {
      // Not enough data - use conservative estimates
      return {
        current_price: currentPrice,
        predicted_30_days: currentPrice * 0.98, // Assume 2% depreciation
        predicted_60_days: currentPrice * 0.96,
        predicted_90_days: currentPrice * 0.94,
        trend: "depreciating",
        confidence: 30, // Low confidence
      };
    }

    // Simple linear regression
    const prices = trends.map((t) => t.avg_price);
    const n = prices.length;

    // Calculate slope (rate of change)
    const firstPrice = prices[0];
    const lastPrice = prices[n - 1];
    const priceChange = lastPrice - firstPrice;
    const daysSpan = Math.max(1, n * 7); // Assuming weekly data points
    const dailyChange = priceChange / daysSpan;

    // Project future prices
    const predicted30 = currentPrice + dailyChange * 30;
    const predicted60 = currentPrice + dailyChange * 60;
    const predicted90 = currentPrice + dailyChange * 90;

    // Determine trend
    let trend: "appreciating" | "stable" | "depreciating";
    if (dailyChange > 5) trend = "appreciating";
    else if (dailyChange < -5) trend = "depreciating";
    else trend = "stable";

    // Calculate confidence based on data consistency
    const variance = calculateVariance(prices);
    const confidence = Math.max(30, Math.min(95, 100 - variance / 100));

    return {
      current_price: currentPrice,
      predicted_30_days: Math.round(predicted30),
      predicted_60_days: Math.round(predicted60),
      predicted_90_days: Math.round(predicted90),
      trend,
      confidence: Math.round(confidence),
    };
  } catch (error) {
    console.error("[PredictiveModel] Error predicting price:", error);
    // Fallback to conservative estimates
    return {
      current_price: currentPrice,
      predicted_30_days: currentPrice * 0.98,
      predicted_60_days: currentPrice * 0.96,
      predicted_90_days: currentPrice * 0.94,
      trend: "depreciating",
      confidence: 30,
    };
  }
}

/**
 * Predict days to sell based on historical data and current market
 */
export async function predictDaysToSell(
  make: string,
  model: string,
  price: number,
  condition: string,
  mileage?: number,
): Promise<DaysToSellPrediction> {
  const supabase = createServerComponentClient();

  try {
    // Get market trends
    const { data: trends } = await supabase
      .from("market_trends")
      .select("avg_price, avg_days_to_sell, demand_score")
      .ilike("make", make)
      .ilike("model", `%${model}%`)
      .order("recorded_at", { ascending: false })
      .limit(1);

    const trend = trends?.[0];
    const baseDays = trend?.avg_days_to_sell || 21; // Default 3 weeks
    const avgPrice = trend?.avg_price || price;
    const demandScore = trend?.demand_score || 5;

    // Factor 1: Price relative to market (±40%)
    let priceFactor = 1.0;
    if (avgPrice > 0) {
      const priceRatio = price / avgPrice;
      if (priceRatio < 0.8)
        priceFactor = 0.7; // Priced low = sells faster
      else if (priceRatio < 0.9) priceFactor = 0.85;
      else if (priceRatio < 1.1)
        priceFactor = 1.0; // At market
      else if (priceRatio < 1.2) priceFactor = 1.2;
      else priceFactor = 1.5; // Priced high = sells slower
    }

    // Factor 2: Demand (±30%)
    let demandFactor = 1.0;
    if (demandScore >= 8)
      demandFactor = 0.7; // High demand
    else if (demandScore >= 6) demandFactor = 0.85;
    else if (demandScore >= 4) demandFactor = 1.0;
    else if (demandScore >= 2) demandFactor = 1.2;
    else demandFactor = 1.4; // Low demand

    // Factor 3: Seasonality (±20%)
    const seasonFactor = calculateSeasonalityFactor(make, model);

    // Factor 4: Condition (±30%)
    let conditionFactor = 1.0;
    if (condition === "clean" || condition === "excellent")
      conditionFactor = 0.8;
    else if (condition === "runs") conditionFactor = 1.1;
    else if (condition === "salvage") conditionFactor = 1.4;

    // Factor 5: Mileage (±20%)
    let mileageFactor = 1.0;
    if (mileage) {
      if (mileage < 30000)
        mileageFactor = 0.85; // Low mileage
      else if (mileage < 60000) mileageFactor = 0.95;
      else if (mileage < 100000) mileageFactor = 1.0;
      else if (mileage < 150000) mileageFactor = 1.15;
      else mileageFactor = 1.3; // High mileage
    }

    // Combine all factors
    const predictedDays = Math.round(
      baseDays *
        priceFactor *
        demandFactor *
        seasonFactor *
        conditionFactor *
        mileageFactor,
    );

    // Calculate confidence (more data = higher confidence)
    const confidence = trend ? 75 : 50;

    return {
      predicted_days: Math.max(3, Math.min(90, predictedDays)), // Clamp 3-90 days
      confidence,
      factors: {
        price_factor: priceFactor,
        demand_factor: demandFactor,
        season_factor: seasonFactor,
        condition_factor: conditionFactor,
      },
    };
  } catch (error) {
    console.error("[PredictiveModel] Error predicting days to sell:", error);
    return {
      predicted_days: 21, // Default 3 weeks
      confidence: 40,
      factors: {
        price_factor: 1.0,
        demand_factor: 1.0,
        season_factor: 1.0,
        condition_factor: 1.0,
      },
    };
  }
}

/**
 * Assess risk factors for a deal
 */
export function assessRisk(
  source: string,
  condition: string,
  distance: number,
  marketSupply: number,
  priceVsMarket: number,
): RiskAssessment {
  const warnings: string[] = [];

  // 1. Hidden Issues Risk (0-100)
  let hiddenIssuesRisk = 0;

  // Source risk
  if (source === "copart" || source === "iaa") {
    hiddenIssuesRisk += 40; // Salvage auctions
    warnings.push("Salvage auction - high risk of hidden damage");
  } else if (source === "craigslist" || source === "offerup") {
    hiddenIssuesRisk += 25; // Private sellers
    warnings.push("Private seller - limited recourse for issues");
  } else if (source === "manheim" || source === "adesa") {
    hiddenIssuesRisk += 15; // Dealer auctions
  } else {
    hiddenIssuesRisk += 5; // Retail dealers
  }

  // Condition risk
  if (condition === "salvage") {
    hiddenIssuesRisk += 30;
    warnings.push("Salvage title - expect significant repairs");
  } else if (condition === "runs") {
    hiddenIssuesRisk += 15;
  }

  // 2. Transport Risk (0-100)
  let transportRisk = 0;
  if (distance > 1500) {
    transportRisk = 60;
    warnings.push("Very long distance - high transport cost and risk");
  } else if (distance > 1000) {
    transportRisk = 40;
    warnings.push("Long distance transport - verify quote");
  } else if (distance > 500) {
    transportRisk = 20;
  } else {
    transportRisk = 5;
  }

  // 3. Market Risk (0-100)
  let marketRisk = 0;

  // Oversupply risk
  if (marketSupply > 50) {
    marketRisk += 40;
    warnings.push("Oversaturated market - may be hard to sell");
  } else if (marketSupply > 30) {
    marketRisk += 25;
  } else if (marketSupply > 15) {
    marketRisk += 10;
  }

  // Price risk
  if (priceVsMarket < 0.5) {
    marketRisk += 30;
    warnings.push("Price far below market - possible hidden issues");
  } else if (priceVsMarket > 1.2) {
    marketRisk += 20;
    warnings.push("Price above market - may take longer to sell");
  }

  // 4. Holding Risk (0-100) - Based on predicted days to sell
  let holdingRisk = 0;
  // This would be calculated based on predicted days to sell
  // For now, use market supply as proxy
  if (marketSupply > 30) holdingRisk = 50;
  else if (marketSupply > 15) holdingRisk = 30;
  else holdingRisk = 15;

  // Overall risk score (weighted average)
  const riskScore = Math.round(
    hiddenIssuesRisk * 0.35 +
      transportRisk * 0.2 +
      marketRisk * 0.3 +
      holdingRisk * 0.15,
  );

  // Determine overall risk level
  let overallRisk: "low" | "medium" | "high";
  if (riskScore < 25) overallRisk = "low";
  else if (riskScore < 50) overallRisk = "medium";
  else overallRisk = "high";

  return {
    overall_risk: overallRisk,
    risk_score: riskScore,
    risk_factors: {
      hidden_issues_risk: hiddenIssuesRisk,
      transport_risk: transportRisk,
      market_risk: marketRisk,
      holding_risk: holdingRisk,
    },
    warnings,
  };
}

/**
 * Calculate seasonality factor for days-to-sell
 */
function calculateSeasonalityFactor(make: string, model: string): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const makeModel = `${make} ${model}`.toLowerCase();

  // Convertibles - peak spring/summer
  if (makeModel.includes("convertible") || makeModel.includes("roadster")) {
    if (month >= 4 && month <= 8)
      return 0.7; // Peak season
    else if (month >= 9 && month <= 11) return 1.2;
    else return 1.4; // Winter
  }

  // SUVs/4WD - peak fall/winter
  if (
    makeModel.includes("suv") ||
    makeModel.includes("4wd") ||
    makeModel.includes("awd") ||
    makeModel.includes("truck")
  ) {
    if (month >= 10 || month <= 2)
      return 0.7; // Peak season
    else if (month >= 3 && month <= 5) return 1.0;
    else return 1.2; // Summer
  }

  // Sports cars - peak spring/summer
  if (
    makeModel.includes("corvette") ||
    makeModel.includes("mustang") ||
    makeModel.includes("camaro") ||
    makeModel.includes("porsche")
  ) {
    if (month >= 4 && month <= 8) return 0.8;
    else return 1.2;
  }

  return 1.0; // No strong seasonality
}

/**
 * Calculate variance for confidence scoring
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length < 2) return 0;

  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;

  return Math.sqrt(variance); // Return standard deviation
}
