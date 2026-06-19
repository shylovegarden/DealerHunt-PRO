'use client';
import React, { useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';

interface DealAnalyzerProps {
  askPrice: number;
  wholesaleEstimate: number;
  baseTransportCost: number;
  baseRepairCost: number;
}

export function DealAnalyzer({ askPrice, wholesaleEstimate, baseTransportCost, baseRepairCost }: DealAnalyzerProps) {
  const [damageType, setDamageType] = useState('none');
  
  // Dynamic repair multipliers based on selected damage
  const getRepairCost = () => {
    switch(damageType) {
      case 'none': return baseRepairCost || 0;
      case 'hail': return (baseRepairCost || 0) + 1200;
      case 'minor_collision': return (baseRepairCost || 0) + 2500;
      case 'major_collision': return (baseRepairCost || 0) + 8500;
      default: return baseRepairCost || 0;
    }
  };

  const currentRepairCost = getRepairCost();
  const netProfit = wholesaleEstimate - askPrice - baseTransportCost - currentRepairCost;
  const isProfitable = netProfit > 0;

  return (
    <div className="bg-[#16181E] border border-white/10 rounded-2xl p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
        <h3 className="text-gray-100 font-bold flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-500" />
          Deal Analyzer
        </h3>
        <div className={`px-3 py-1 text-xs font-bold rounded-full ${isProfitable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {isProfitable ? 'GO' : 'PASS'}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Est. Wholesale (MMR)</span>
          <span className="text-gray-200">${wholesaleEstimate.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Ask Price</span>
          <span className="text-red-400">-${askPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Transport (Est.)</span>
          <span className="text-red-400">-${baseTransportCost.toLocaleString()}</span>
        </div>
        
        {/* Interactive Repair Cost */}
        <div className="flex justify-between items-center text-gray-400 pt-2 border-t border-white/5">
          <select 
            className="bg-black/50 border border-white/10 text-xs rounded-md px-2 py-1 outline-none focus:border-indigo-500 transition-colors"
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
          >
            <option value="none">Clean / Minor Wear</option>
            <option value="hail">Hail Damage</option>
            <option value="minor_collision">Minor Collision</option>
            <option value="major_collision">Major Collision</option>
          </select>
          <span className="text-red-400">-${currentRepairCost.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center">
        <span className="text-gray-300 font-semibold">True Net Profit</span>
        <div className={`text-xl font-bold flex items-center gap-1 ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
          {isProfitable && <TrendingUp className="w-5 h-5" />}
          ${netProfit.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
