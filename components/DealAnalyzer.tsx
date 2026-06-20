'use client';
import React, { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { Tag } from '@/components/shared/Tag';
import { Mono } from '@/components/shared/Mono';

interface DealAnalyzerProps {
  askPrice: number;
  wholesaleEstimate: number;
  baseTransportCost: number;
  baseRepairCost: number;
}

export function DealAnalyzer({ askPrice, wholesaleEstimate, baseTransportCost, baseRepairCost }: DealAnalyzerProps) {
  const [damageType, setDamageType] = useState('none');

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
    <Panel padding="md">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[rgba(255,255,255,.06)]">
        <h3 className="text-[#FAFAFA] font-bold text-sm">Deal Analyzer</h3>
        <Tag color={isProfitable ? 'green' : 'red'}>{isProfitable ? 'GO' : 'PASS'}</Tag>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-[#9898A8]">
          <span>Est. Wholesale (MMR)</span>
          <Mono className="text-[#FAFAFA]">${wholesaleEstimate.toLocaleString()}</Mono>
        </div>
        <div className="flex justify-between text-[#9898A8]">
          <span>Ask Price</span>
          <Mono className="text-[#EF4444]">-${askPrice.toLocaleString()}</Mono>
        </div>
        <div className="flex justify-between text-[#9898A8]">
          <span>Transport (Est.)</span>
          <Mono className="text-[#EF4444]">-${baseTransportCost.toLocaleString()}</Mono>
        </div>

        <div className="flex justify-between items-center text-[#9898A8] pt-2 border-t border-[rgba(255,255,255,.06)]">
          <select
            className="bg-[#18181D] border border-[rgba(255,255,255,.10)] text-xs rounded-md px-2 py-1 outline-none focus:border-[#F59E0B] transition-colors"
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
          >
            <option value="none">Clean / Minor Wear</option>
            <option value="hail">Hail Damage</option>
            <option value="minor_collision">Minor Collision</option>
            <option value="major_collision">Major Collision</option>
          </select>
          <Mono className="text-[#EF4444]">-${currentRepairCost.toLocaleString()}</Mono>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,.10)] flex justify-between items-center">
        <span className="text-[#D1D1DC] font-semibold">True Net Profit</span>
        <Mono className={`text-xl font-bold ${isProfitable ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
          {netProfit > 0 ? '+' : '-'}${Math.abs(netProfit).toLocaleString()}
        </Mono>
      </div>
    </Panel>
  );
}
