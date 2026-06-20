'use client'

import React from 'react'
import Link from 'next/link'
import { Panel } from './Panel'
import { Tag } from './Tag'
import { Mono } from './Mono'
import { Ico } from './Ico'
import { Deal } from '@/lib/data/deals-service'

interface DealCardProps {
  deal: Deal
  onSelect?: (deal: Deal) => void
}

export function DealCard({ deal, onSelect }: DealCardProps) {
  const profitColor = deal.profitEstimate > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
  const transportCost = 450
  const repairEstimate = deal.damageType ? Math.max(500, Math.round((deal.mmrValue || 0) * 0.04)) : 0
  const netProfit = (deal.mmrValue || deal.askPrice) - deal.askPrice - transportCost - repairEstimate
  const trueRoi = deal.askPrice > 0 ? (netProfit / deal.askPrice) * 100 : 0
  const location = [deal.locationCity, deal.locationState].filter(Boolean).join(', ')
  const isHot = (deal.profitScore ?? 0) >= 80

  return (
    <Panel className="group relative overflow-hidden p-0 border border-[rgba(255,255,255,.06)] hover:border-[rgba(255,255,255,.12)] bg-[#0C0C0F] transition-all duration-300 rounded-2xl flex flex-col sm:flex-row">
      {/* Vehicle Thumbnail */}
      <div className="relative w-full sm:w-44 h-48 sm:h-auto bg-[#18181D] shrink-0 overflow-hidden">
        {deal.images && deal.images.length > 0 ? (
          <img
            src={deal.images[0]}
            alt={deal.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#42424E] space-y-1">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] uppercase tracking-wider font-semibold">No Image</span>
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-[#07070A]/85 backdrop-blur border border-[rgba(255,255,255,.08)] text-[#FAFAFA] uppercase tracking-wider">
            {deal.source}
          </span>
        </div>
      </div>

      {/* Details Area */}
      <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-bold text-base text-[#FAFAFA] truncate group-hover:text-[#F59E0B] transition-colors">
              {deal.year} {deal.make} {deal.model} {deal.trim || ''}
            </h3>
            {isHot && (
              <span className="shrink-0 px-2 py-0.5 text-[9px] font-extrabold tracking-wider bg-[rgba(239,68,68,.10)] text-[#EF4444] border border-[rgba(239,68,68,.20)] rounded-md uppercase">
                Hot Deal
              </span>
            )}
          </div>
          <p className="text-xs text-[#62627A] mb-4 flex flex-wrap gap-x-2 items-center">
            <span className="font-mono text-[#9898A8]">{deal.vin || 'NO VIN'}</span>
            <span className="text-[#42424E]">•</span>
            <span>{deal.mileage ? `${deal.mileage.toLocaleString()} mi` : 'MIL N/A'}</span>
            <span className="text-[#42424E]">•</span>
            <span className="truncate">{location || 'LOC N/A'}</span>
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4 bg-[#111115] border border-[rgba(255,255,255,.03)] p-3 rounded-xl">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#62627A] font-semibold mb-0.5">Ask Price</p>
              <Mono className="text-sm font-extrabold text-[#FAFAFA]">${deal.askPrice.toLocaleString()}</Mono>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#62627A] font-semibold mb-0.5">MMR Value</p>
              <Mono className="text-sm font-extrabold text-[#9898A8]">${deal.mmrValue ? deal.mmrValue.toLocaleString() : 'N/A'}</Mono>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#62627A] font-semibold mb-0.5">True Net</p>
              <Mono className={`text-sm font-extrabold ${profitColor}`}>
                {netProfit > 0 ? '+' : '-'}${Math.abs(netProfit).toLocaleString()}
              </Mono>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[rgba(255,255,255,.04)] mt-auto">
          <div className="flex items-center gap-2">
            <Tag color={(deal.profitScore ?? 0) >= 80 ? 'green' : (deal.profitScore ?? 0) >= 60 ? 'amber' : 'red'}>
              Score: {deal.profitScore ?? 'N/A'}/100
            </Tag>
            <Tag color={['clean_title', 'run_drive'].includes(deal.condition) ? 'green' : 'amber'}>
              {deal.condition}
            </Tag>
          </div>
          
          <Link
            href={`/deal/${deal.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#F59E0B] hover:text-[#FAFAFA] bg-[rgba(245,158,11,.08)] hover:bg-[#F59E0B] border border-[rgba(245,158,11,.16)] hover:border-transparent rounded-lg transition-all"
          >
            <span>Analyze</span>
            <Ico name="arrow" size={12} className="rotate-45" />
          </Link>
        </div>
      </div>
    </Panel>
  )
}
