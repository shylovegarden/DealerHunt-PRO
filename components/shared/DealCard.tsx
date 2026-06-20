'use client'

import React from 'react'
import { Panel } from './Panel'
import { Tag } from './Tag'
import { Mono } from './Mono'
import { Ico } from './Ico'
import { MockDeal } from '@/lib/utils/mockDeals'

interface DealCardProps {
  deal: MockDeal
  onSelect?: (deal: MockDeal) => void
}

export function DealCard({ deal, onSelect }: DealCardProps) {
  const profitColor = deal.profit > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
  const transportCost = 450
  const repairEstimate = deal.damage === 'Clean' ? 0 : Math.max(500, Math.round(deal.mmr * 0.04))
  const netProfit = deal.mmr - deal.price - transportCost - repairEstimate
  const trueRoi = deal.price > 0 ? (netProfit / deal.price) * 100 : 0

  return (
    <Panel className="group relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[#FAFAFA] truncate">
              {deal.year} {deal.make} {deal.model} {deal.trim}
            </h3>
            {deal.hot && <Tag color="red">Hot</Tag>}
          </div>
          <p className="text-xs text-[#62627A] mb-3">
            {deal.vin} · {deal.mileage.toLocaleString()} mi · {deal.location} · {deal.postedAt}
          </p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#62627A]">Ask</p>
              <Mono className="text-sm font-bold text-[#FAFAFA]">${deal.price.toLocaleString()}</Mono>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#62627A]">MMR</p>
              <Mono className="text-sm font-bold text-[#FAFAFA]">${deal.mmr.toLocaleString()}</Mono>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#62627A]">Net</p>
              <Mono className={`text-sm font-bold ${profitColor}`}>
                {netProfit > 0 ? '+' : '-'}${Math.abs(netProfit).toLocaleString()}
              </Mono>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Tag color={deal.score >= 80 ? 'green' : deal.score >= 60 ? 'amber' : 'red'}>{deal.score}/100</Tag>
            <Tag color="blue">{deal.source}</Tag>
            <Tag color={deal.title === 'Clean' ? 'green' : 'red'}>{deal.title}</Tag>
            {deal.damage && deal.damage !== 'Clean' && <Tag color="amber">{deal.damage}</Tag>}
          </div>
        </div>

        <button
          onClick={() => onSelect?.(deal)}
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(255,255,255,.10)] text-[#9898A8] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors"
          aria-label="Analyze deal"
        >
          <Ico name="deal" size={18} />
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,.06)] flex items-center justify-between text-xs text-[#9898A8]">
        <span>ROI {trueRoi.toFixed(1)}%</span>
        <span className="flex items-center gap-1">
          <Ico name="arrow" size={14} className="rotate-45" /> View details
        </span>
      </div>
    </Panel>
  )
}
