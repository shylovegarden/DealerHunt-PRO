'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field, SelectField } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'
import { Tag } from '@/components/shared/Tag'
import { Mono } from '@/components/shared/Mono'
import { DAMAGE_TYPES } from '@/lib/utils/constants'
import { getTitleRules, US_STATES } from '@/lib/utils/titleRules'
import { cn } from '@/lib/utils'

type Verdict = 'go' | 'hold' | 'pass'

interface DealInputs {
  askPrice: number
  auctionFee: number
  titleFee: number
  holdingDays: number
  dailyFloorRate: number
  damageType: string
  repairCost: number
  reconCost: number
  fromState: string
  toState: string
  miles: number
  trailerType: 'open' | 'enclosed'
  transportCost: number
  salePrice: number
  sellingFee: number
}

const DEFAULT_INPUTS: DealInputs = {
  askPrice: 13200,
  auctionFee: 450,
  titleFee: 120,
  holdingDays: 0,
  dailyFloorRate: 35,
  damageType: 'clean',
  repairCost: 0,
  reconCost: 500,
  fromState: 'TX',
  toState: 'CA',
  miles: 1400,
  trailerType: 'open',
  transportCost: 0,
  salePrice: 18000,
  sellingFee: 299,
}

function computeTransportCost(miles: number, trailerType: 'open' | 'enclosed') {
  const rates = { open: 0.78, enclosed: 1.28 }
  const minimums = { open: 350, enclosed: 600 }
  const base = Math.round(miles * rates[trailerType])
  return Math.max(minimums[trailerType], base)
}

function computeDeal(inputs: DealInputs) {
  const damage = DAMAGE_TYPES.find((d) => d.value === inputs.damageType) || DAMAGE_TYPES[0]
  const repairCost = inputs.repairCost || damage.repair
  const holdingCost = inputs.holdingDays * inputs.dailyFloorRate
  const transportCost = inputs.transportCost || computeTransportCost(inputs.miles, inputs.trailerType)
  const totalCost = inputs.askPrice + inputs.auctionFee + inputs.titleFee + holdingCost + repairCost + inputs.reconCost + transportCost
  const net = inputs.salePrice - inputs.sellingFee
  const profit = net - totalCost
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
  const breakEvenDay = inputs.dailyFloorRate > 0 ? Math.round(totalCost / inputs.dailyFloorRate) : 0

  let score = 0
  if (profit > 6000) score += 35
  else if (profit > 4500) score += 28
  else if (profit > 3000) score += 20
  else if (profit > 1500) score += 12
  else score += 5

  if (roi > 45) score += 25
  else if (roi > 30) score += 20
  else if (roi > 20) score += 15
  else if (roi > 12) score += 8
  else score += 3

  const titleType = 'clean'
  const titlePoints: Record<string, number> = { clean: 20, lien: 14, rebuilt: 8, salvage: 4, parts: 0 }
  score += titlePoints[titleType] ?? 10

  if (inputs.damageType === 'clean' || inputs.damageType === 'minor_scratch') score += 12
  else if (inputs.damageType === 'hail' || inputs.damageType === 'rear_end') score += 10
  else if (inputs.damageType === 'front_end' || inputs.damageType === 'mechanical') score += 7
  else if (inputs.damageType === 'side_damage' || inputs.damageType === 'flood') score += 4
  else if (inputs.damageType === 'fire' || inputs.damageType === 'frame') score += 1
  else score += 10

  score = Math.max(0, Math.min(100, Math.round(score)))

  let verdict: Verdict = 'pass'
  if (profit > 4000 && roi > 20) verdict = 'go'
  else if (profit > 1500 || roi > 10) verdict = 'hold'

  return { repairCost, holdingCost, transportCost, totalCost, net, profit, roi, breakEvenDay, score, verdict, damageLabel: damage.label }
}

export default function DealPage() {
  const [inputs, setInputs] = useState<DealInputs>(DEFAULT_INPUTS)
  const [autoTransport, setAutoTransport] = useState(true)

  const result = useMemo(() => computeDeal(inputs), [inputs])

  useEffect(() => {
    if (autoTransport) {
      setInputs((prev) => ({ ...prev, transportCost: computeTransportCost(prev.miles, prev.trailerType) }))
    }
  }, [inputs.miles, inputs.trailerType, autoTransport])

  const update = (patch: Partial<DealInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }))
  }

  const titleRules = getTitleRules(inputs.fromState, inputs.toState)
  const verdictConfig = {
    go: { label: 'GO', color: 'text-[#10B981]', bg: 'bg-[rgba(16,185,129,.10)]', border: 'border-[rgba(16,185,129,.20)]' },
    hold: { label: 'HOLD', color: 'text-[#F59E0B]', bg: 'bg-[rgba(245,158,11,.10)]', border: 'border-[rgba(245,158,11,.22)]' },
    pass: { label: 'PASS', color: 'text-[#EF4444]', bg: 'bg-[rgba(239,68,68,.10)]', border: 'border-[rgba(239,68,68,.20)]' },
  }

  const costRows = [
    { label: 'Purchase', value: inputs.askPrice },
    { label: 'Auction Fee', value: inputs.auctionFee },
    { label: 'Title Fee', value: inputs.titleFee },
    { label: 'Holding', value: result.holdingCost },
    { label: 'Transport', value: result.transportCost },
    { label: 'Repair', value: result.repairCost },
    { label: 'Recon', value: inputs.reconCost },
  ]

  const maxCost = Math.max(...costRows.map((r) => r.value), 1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      {/* LEFT COLUMN — Inputs */}
      <div className="space-y-4">
        <Panel>
          <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-4">Acquisition</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Ask / Bid" type="number" value={inputs.askPrice} onChange={(e) => update({ askPrice: Number(e.target.value) })} />
            <Field label="Auction Fee" type="number" value={inputs.auctionFee} onChange={(e) => update({ auctionFee: Number(e.target.value) })} />
            <Field label="Title / Paperwork" type="number" value={inputs.titleFee} onChange={(e) => update({ titleFee: Number(e.target.value) })} />
            <Field label="Holding Days" type="number" value={inputs.holdingDays} onChange={(e) => update({ holdingDays: Number(e.target.value) })} />
          </div>
        </Panel>

        <Panel>
          <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-4">Repair Estimate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField
              label="Damage Type"
              options={DAMAGE_TYPES.map((d) => ({ value: d.value, label: d.label }))}
              value={inputs.damageType}
              onChange={(e) => update({ damageType: e.target.value, repairCost: 0 })}
            />
            <Field label="Repair Cost" type="number" value={inputs.repairCost || result.repairCost} onChange={(e) => update({ repairCost: Number(e.target.value) })} />
            <Field label="Recon / Detail" type="number" value={inputs.reconCost} onChange={(e) => update({ reconCost: Number(e.target.value) })} />
          </div>
        </Panel>

        <Panel>
          <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-4">Transport</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="From State" options={US_STATES.map((s: string) => ({ value: s, label: s }))} value={inputs.fromState} onChange={(e) => update({ fromState: e.target.value })} />
            <SelectField label="To State" options={US_STATES.map((s: string) => ({ value: s, label: s }))} value={inputs.toState} onChange={(e) => update({ toState: e.target.value })} />
            <Field label="Miles" type="number" value={inputs.miles} onChange={(e) => update({ miles: Number(e.target.value) })} />
            <SelectField
              label="Carrier Type"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'enclosed', label: 'Enclosed' },
              ]}
              value={inputs.trailerType}
              onChange={(e) => update({ trailerType: e.target.value as 'open' | 'enclosed' })}
            />
            <div className="sm:col-span-2 flex items-center gap-3">
              <input
                id="auto-transport"
                type="checkbox"
                checked={autoTransport}
                onChange={(e) => setAutoTransport(e.target.checked)}
                className="h-4 w-4 rounded border-[rgba(255,255,255,.10)] bg-[#18181D] text-[#F59E0B] focus:ring-[#F59E0B]"
              />
              <label htmlFor="auto-transport" className="text-sm text-[#D1D1DC]">Auto-calculate transport (${result.transportCost})</label>
            </div>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-4">Sale</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="MMR / Sale Price" type="number" value={inputs.salePrice} onChange={(e) => update({ salePrice: Number(e.target.value) })} />
            <Field label="Selling Fee" type="number" value={inputs.sellingFee} onChange={(e) => update({ sellingFee: Number(e.target.value) })} />
          </div>
        </Panel>
      </div>

      {/* RIGHT COLUMN — Results */}
      <div className="space-y-4">
        <Panel className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-[#9898A8] uppercase tracking-wider mb-1">Deal Score</p>
              <p className="text-3xl font-bold text-[#FAFAFA]">{result.score}/100</p>
            </div>
            <div className={cn('px-5 py-3 rounded-xl border text-center min-w-[120px]', result.verdict === 'go' && verdictConfig.go.bg, result.verdict === 'hold' && verdictConfig.hold.bg, result.verdict === 'pass' && verdictConfig.pass.bg, result.verdict === 'go' && verdictConfig.go.border, result.verdict === 'hold' && verdictConfig.hold.border, result.verdict === 'pass' && verdictConfig.pass.border)}>
              <p className={cn('text-2xl font-black', verdictConfig[result.verdict].color)}>{verdictConfig[result.verdict].label}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-[#9898A8] uppercase tracking-wider mb-1">Net Profit</p>
              <Mono className={cn('text-2xl font-bold', result.profit > 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                {result.profit > 0 ? '+' : '-'}${Math.abs(result.profit).toLocaleString()}
              </Mono>
            </div>
            <div>
              <p className="text-xs text-[#9898A8] uppercase tracking-wider mb-1">Total Cost</p>
              <Mono className="text-2xl font-bold text-[#F59E0B]">${result.totalCost.toLocaleString()}</Mono>
            </div>
            <div>
              <p className="text-xs text-[#9898A8] uppercase tracking-wider mb-1">ROI</p>
              <Mono className="text-xl font-bold text-[#FAFAFA]">{result.roi.toFixed(1)}%</Mono>
            </div>
            <div>
              <p className="text-xs text-[#9898A8] uppercase tracking-wider mb-1">Break-Even</p>
              <Mono className="text-xl font-bold text-[#FAFAFA]">Day {result.breakEvenDay}</Mono>
            </div>
          </div>

          <p className="text-sm text-[#D1D1DC]">
            <Mono className="font-bold">${Math.abs(result.profit).toLocaleString()}</Mono> net after all costs including transport. {result.roi.toFixed(1)}% ROI.
          </p>
        </Panel>

        <Panel>
          <h3 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-4">Cost Breakdown</h3>
          <div className="space-y-3">
            {costRows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-24 text-xs text-[#9898A8]">{row.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[#18181D] overflow-hidden">
                  <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${Math.min(100, (row.value / maxCost) * 100)}%` }} />
                </div>
                <Mono className="w-20 text-right text-sm text-[#FAFAFA]">${row.value.toLocaleString()}</Mono>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-2 border-t border-[rgba(255,255,255,.06)]">
              <span className="w-24 text-xs font-semibold text-[#D1D1DC]">Total</span>
              <div className="flex-1" />
              <Mono className="w-20 text-right text-sm font-bold text-[#F59E0B]">${result.totalCost.toLocaleString()}</Mono>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider">Floorplan Clock</h3>
            {inputs.holdingDays > 20 && <Tag color="red">Aging</Tag>}
          </div>
          <p className="text-sm text-[#D1D1DC]">
            At <Mono className="text-[#F59E0B]">${inputs.dailyFloorRate}/day</Mono> carrying cost, this deal needs to close before <Mono className="font-bold">Day {result.breakEvenDay}</Mono>. Current holding: <Mono className="text-[#FAFAFA]">{inputs.holdingDays} days</Mono>.
          </p>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider">Title Requirements</h3>
            <Tag color={titleRules.warning ? 'red' : 'green'}>{titleRules.warning ? 'Warning' : 'Clean'}</Tag>
          </div>
          <p className="text-sm text-[#9898A8] mb-3">{titleRules.note}</p>
          <ul className="space-y-2">
            {titleRules.requirements.map((req, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-[#D1D1DC]">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {req}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid grid-cols-3 gap-3">
          <Btn variant="ghost" className="w-full">Save Deal</Btn>
          <Btn variant="primary" className="w-full sm:col-span-2">List It</Btn>
        </div>
      </div>
    </div>
  )
}
