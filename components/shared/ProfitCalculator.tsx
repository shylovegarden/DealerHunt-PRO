"use client";

import { useState, useMemo } from "react";
import { Mono } from "./Mono";
import { Ico } from "./Ico";
import { cn } from "@/lib/utils";

interface ProfitCalculatorProps {
  askPrice: number;
  marketValue: number;
  className?: string;
  defaults?: {
    auctionFee?: number;
    transportCost?: number;
    repairCost?: number;
    reconCost?: number;
    titleFee?: number;
    floorDays?: number;
    dailyFloorRate?: number;
  };
}

export function ProfitCalculator({
  askPrice,
  marketValue,
  className,
  defaults = {},
}: ProfitCalculatorProps) {
  const [auctionFee, setAuctionFee] = useState(defaults.auctionFee ?? 450);
  const [transportCost, setTransportCost] = useState(
    defaults.transportCost ?? 300,
  );
  const [repairCost, setRepairCost] = useState(defaults.repairCost ?? 0);
  const [reconCost, setReconCost] = useState(defaults.reconCost ?? 500);
  const [titleFee, setTitleFee] = useState(defaults.titleFee ?? 150);
  const [floorDays, setFloorDays] = useState(defaults.floorDays ?? 30);
  const [dailyFloorRate, setDailyFloorRate] = useState(
    defaults.dailyFloorRate ?? 35,
  );

  const calculations = useMemo(() => {
    const totalCost =
      askPrice + auctionFee + transportCost + repairCost + reconCost + titleFee;
    const floorPlanCost = floorDays * dailyFloorRate;
    const totalWithFloor = totalCost + floorPlanCost;
    const grossProfit = marketValue - totalCost;
    const netProfit = marketValue - totalWithFloor;
    const roi = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;
    const netROI = totalWithFloor > 0 ? (netProfit / totalWithFloor) * 100 : 0;

    return {
      totalCost,
      floorPlanCost,
      totalWithFloor,
      grossProfit,
      netProfit,
      roi,
      netROI,
      breakEven: totalWithFloor,
    };
  }, [
    askPrice,
    auctionFee,
    transportCost,
    repairCost,
    reconCost,
    titleFee,
    floorDays,
    dailyFloorRate,
    marketValue,
  ]);

  const profitColor =
    calculations.netProfit > 0 ? "var(--green)" : "var(--red)";

  return (
    <div className={cn("glass-panel p-4 space-y-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Ico name="calculator" size={20} className="text-[var(--amber)]" />
        <h3 className="text-sm font-black text-[var(--t1)] uppercase tracking-wider">
          Profit Calculator
        </h3>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-[var(--t3)] block mb-1">Auction Fee</label>
          <input
            type="number"
            value={auctionFee}
            onChange={(e) => setAuctionFee(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-[var(--s2)] border border-[var(--b1)] rounded text-[var(--t1)]"
          />
        </div>
        <div>
          <label className="text-[var(--t3)] block mb-1">Transport</label>
          <input
            type="number"
            value={transportCost}
            onChange={(e) => setTransportCost(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-[var(--s2)] border border-[var(--b1)] rounded text-[var(--t1)]"
          />
        </div>
        <div>
          <label className="text-[var(--t3)] block mb-1">Repair</label>
          <input
            type="number"
            value={repairCost}
            onChange={(e) => setRepairCost(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-[var(--s2)] border border-[var(--b1)] rounded text-[var(--t1)]"
          />
        </div>
        <div>
          <label className="text-[var(--t3)] block mb-1">Recon</label>
          <input
            type="number"
            value={reconCost}
            onChange={(e) => setReconCost(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-[var(--s2)] border border-[var(--b1)] rounded text-[var(--t1)]"
          />
        </div>
        <div>
          <label className="text-[var(--t3)] block mb-1">Title Fee</label>
          <input
            type="number"
            value={titleFee}
            onChange={(e) => setTitleFee(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-[var(--s2)] border border-[var(--b1)] rounded text-[var(--t1)]"
          />
        </div>
        <div>
          <label className="text-[var(--t3)] block mb-1">Floor Days</label>
          <input
            type="number"
            value={floorDays}
            onChange={(e) => setFloorDays(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-[var(--s2)] border border-[var(--b1)] rounded text-[var(--t1)]"
          />
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-[var(--b1)] pt-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--t3)]">Total Cost</span>
          <Mono className="text-[var(--t1)]">
            ${calculations.totalCost.toLocaleString()}
          </Mono>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--t3)]">Floor Plan ({floorDays}d)</span>
          <Mono className="text-[var(--t1)]">
            ${calculations.floorPlanCost.toLocaleString()}
          </Mono>
        </div>
        <div className="flex justify-between text-xs font-bold border-t border-[var(--b1)] pt-2">
          <span className="text-[var(--t2)]">Total w/ Floor</span>
          <Mono className="text-[var(--t1)]">
            ${calculations.totalWithFloor.toLocaleString()}
          </Mono>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--t3)]">Market Value</span>
          <Mono className="text-[var(--t1)]">
            ${marketValue.toLocaleString()}
          </Mono>
        </div>
        <div className="flex justify-between text-sm font-black border-t border-[var(--b1)] pt-2">
          <span style={{ color: profitColor }}>Net Profit</span>
          <Mono style={{ color: profitColor }}>
            ${calculations.netProfit.toLocaleString()}
          </Mono>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--t3)]">Net ROI</span>
          <Mono style={{ color: profitColor }}>
            {calculations.netROI.toFixed(1)}%
          </Mono>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="bg-[var(--s2)] rounded-lg p-3 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <Ico name="trending-up" size={14} className="text-[var(--t3)]" />
          <span className="text-[var(--t3)]">
            Break-even:{" "}
            <Mono className="text-[var(--t1)]">
              ${calculations.breakEven.toLocaleString()}
            </Mono>
          </span>
        </div>
        {calculations.netProfit > 0 && (
          <div className="text-[var(--green)]">
            ✓ Profitable deal - {calculations.netROI.toFixed(0)}% ROI
          </div>
        )}
        {calculations.netProfit <= 0 && (
          <div className="text-[var(--red)]">
            ⚠ Loss of ${Math.abs(calculations.netProfit).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
