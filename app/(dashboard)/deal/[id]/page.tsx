'use client'

import React, { useEffect, useMemo, useState, use } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field, SelectField } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'
import { Tag } from '@/components/shared/Tag'
import { Mono } from '@/components/shared/Mono'
import { DAMAGE_TYPES } from '@/lib/utils/repairCosts'
import { getTitleRules, US_STATES } from '@/lib/utils/titleRules'
import { cn } from '@/lib/utils'
import { Deal } from '@/lib/data/deals-service'
import { Ico } from '@/components/shared/Ico'

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
  askPrice: 0,
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
  salePrice: 0,
  sellingFee: 299,
}

// Live transport ranges simulation
function getTransportEstimates(miles: number, trailerType: 'open' | 'enclosed') {
  const base = trailerType === 'open' ? 0.65 : 0.95
  const cost = Math.max(miles * base, trailerType === 'open' ? 350 : 600)
  return {
    budget: Math.round(cost * 0.9),
    standard: Math.round(cost),
    express: Math.round(cost * 1.2),
  }
}

function computeDeal(inputs: DealInputs) {
  const damage = DAMAGE_TYPES.find((d) => d.value === inputs.damageType) || DAMAGE_TYPES[0]
  const holdingCost = inputs.holdingDays * inputs.dailyFloorRate
  const totalCost = inputs.askPrice + inputs.auctionFee + inputs.titleFee + holdingCost + inputs.repairCost + inputs.reconCost + inputs.transportCost
  const net = inputs.salePrice - inputs.sellingFee
  const profit = net - totalCost
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
  const breakEvenDay = inputs.dailyFloorRate > 0 ? Math.round(totalCost / inputs.dailyFloorRate) : 0

  let score = 0
  // Margin points
  if (profit > 6000) score += 35
  else if (profit > 4500) score += 28
  else if (profit > 3000) score += 20
  else if (profit > 1500) score += 12
  else score += 5

  // ROI points
  if (roi > 45) score += 25
  else if (roi > 30) score += 20
  else if (roi > 20) score += 15
  else if (roi > 12) score += 8
  else score += 3

  // Title points
  const titlePoints = 20 // Clean title assumed for now
  score += titlePoints

  // Damage points
  if (inputs.damageType === 'clean') score += 15
  else if (inputs.damageType === 'minor') score += 12
  else if (inputs.damageType === 'hail_mod' || inputs.damageType === 'rear') score += 10
  else if (inputs.damageType === 'front' || inputs.damageType === 'engine') score += 7
  else if (inputs.damageType === 'side' || inputs.damageType === 'flood_mild') score += 4
  else if (inputs.damageType === 'fire' || inputs.damageType === 'frame' || inputs.damageType === 'flood_sev') score += 0
  else score += 5

  // Mileage points
  if (inputs.miles < 50000) score += 5
  else if (inputs.miles > 150000) score -= 5

  score = Math.max(0, Math.min(100, Math.round(score)))

  let verdict: Verdict = 'pass'
  if (profit > 3500 && roi > 20) verdict = 'go'
  else if (profit >= 1500 || roi >= 10) verdict = 'hold'

  return { holdingCost, totalCost, net, profit, roi, breakEvenDay, score, verdict, damageLabel: damage.label }
}

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [inputs, setInputs] = useState<DealInputs>(DEFAULT_INPUTS)

  useEffect(() => {
    fetch(`/api/deals/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else if (data.deal) {
          setDeal(data.deal)
          const d = data.deal as Deal

          setInputs((prev) => ({
            ...prev,
            askPrice: d.askPrice || 0,
            salePrice: d.mmrValue || (d.askPrice * 1.2),
            damageType: d.damageType || 'clean',
            repairCost: DAMAGE_TYPES.find(dt => dt.value === (d.damageType || 'clean'))?.repair || 0,
            fromState: d.locationState || 'TX',
            miles: d.locationState ? 800 : prev.miles,
          }))
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const result = useMemo(() => computeDeal(inputs), [inputs])
  const transportEst = useMemo(() => getTransportEstimates(inputs.miles, inputs.trailerType), [inputs.miles, inputs.trailerType])

  const update = (patch: Partial<DealInputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...patch }
      // Auto-fill repair cost if damage type changed
      if (patch.damageType) {
        const dmg = DAMAGE_TYPES.find((d) => d.value === patch.damageType)
        if (dmg) next.repairCost = dmg.repair
      }
      return next
    })
  }

  if (loading) {
    return (
      <Panel className="flex items-center justify-center py-20 animate-pulse">
        <p className="text-[#9898A8]">Loading deal analysis...</p>
      </Panel>
    )
  }

  if (error || !deal) {
    return (
      <Panel className="text-center py-12 border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
        <p className="text-[#EF4444]">Error: {error || 'Deal not found'}</p>
      </Panel>
    )
  }

  const titleRules = getTitleRules(inputs.fromState, inputs.toState)

  const verdictConfig = {
    go: { label: 'GO', color: 'text-[#10B981]', bg: 'bg-[rgba(16,185,129,.10)]', border: 'border-[rgba(16,185,129,.20)]', msg: 'Execute Now' },
    hold: { label: 'HOLD', color: 'text-[#F59E0B]', bg: 'bg-[rgba(245,158,11,.10)]', border: 'border-[rgba(245,158,11,.22)]', msg: 'Monitor Value' },
    pass: { label: 'PASS', color: 'text-[#EF4444]', bg: 'bg-[rgba(239,68,68,.10)]', border: 'border-[rgba(239,68,68,.20)]', msg: 'Too Risky' },
  }

  const costRows = [
    { label: 'Purchase', value: inputs.askPrice },
    { label: 'Auction Fee', value: inputs.auctionFee },
    { label: 'Transport', value: inputs.transportCost },
    { label: 'Repair', value: inputs.repairCost },
    { label: 'Recon', value: inputs.reconCost },
    { label: 'Title', value: inputs.titleFee },
    { label: 'Floor', value: result.holdingCost },
  ]
  const maxCost = Math.max(...costRows.map((r) => r.value), 1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fadeUp">
      {/* LEFT COLUMN — Inputs */}
      <div className="space-y-4">
        {/* Deal Header */}
        <Panel className="flex items-center gap-4 bg-[var(--amber-lo)] border-[var(--amber-bd)]">
          <div className="w-16 h-16 rounded-[var(--r3)] bg-[var(--s3)] overflow-hidden shrink-0">
            {deal.images && deal.images.length > 0 ? (
              <img src={deal.images[0]} alt={deal.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--t5)]">
                <Ico name="car" size={24} />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--t1)]">{deal.year} {deal.make} {deal.model}</h1>
            <p className="text-sm text-[var(--t3)] mt-1 flex gap-2 items-center">
              <span className="px-2 py-0.5 rounded-[var(--r1)] bg-[var(--b1)] text-xs text-[var(--t2)] uppercase font-bold">{deal.source}</span>
              <span>•</span>
              <span>{deal.vin || 'NO VIN'}</span>
              <span>•</span>
              <span>{deal.locationCity}, {deal.locationState}</span>
            </p>
          </div>
        </Panel>

        {/* ACQUISITION */}
        <Panel>
          <h2 className="text-sm font-semibold text-[var(--t2)] uppercase tracking-wider mb-4">Acquisition</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Ask / Bid ($)" type="number" value={inputs.askPrice} onChange={(e) => update({ askPrice: Number(e.target.value) })} />
            <Field label="Auction Fee ($)" type="number" value={inputs.auctionFee} onChange={(e) => update({ auctionFee: Number(e.target.value) })} />
            <Field label="Title / Paperwork ($)" type="number" value={inputs.titleFee} onChange={(e) => update({ titleFee: Number(e.target.value) })} />
            <Field label="Holding / Floorplan ($)" type="number" value={inputs.dailyFloorRate} onChange={(e) => update({ dailyFloorRate: Number(e.target.value) })} />
          </div>
        </Panel>

        {/* REPAIR */}
        <Panel>
          <h2 className="text-sm font-semibold text-[var(--t2)] uppercase tracking-wider mb-4">Repair Estimate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField
              label="Damage Type"
              options={DAMAGE_TYPES.map((d) => ({ value: d.value, label: d.label }))}
              value={inputs.damageType}
              onChange={(e) => update({ damageType: e.target.value })}
            />
            <Field label="Repair Cost ($)" type="number" value={inputs.repairCost} onChange={(e) => update({ repairCost: Number(e.target.value) })} />
            <Field label="Recon / Detail ($)" type="number" value={inputs.reconCost} onChange={(e) => update({ reconCost: Number(e.target.value) })} />
          </div>
        </Panel>

        {/* TRANSPORT */}
        <Panel>
          <h2 className="text-sm font-semibold text-[var(--t2)] uppercase tracking-wider mb-4">Transport</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <SelectField label="From State" options={US_STATES.map((s: string) => ({ value: s, label: s }))} value={inputs.fromState} onChange={(e) => update({ fromState: e.target.value })} />
            <SelectField label="To State" options={US_STATES.map((s: string) => ({ value: s, label: s }))} value={inputs.toState} onChange={(e) => update({ toState: e.target.value })} />
            <Field label="Distance (Miles)" type="number" value={inputs.miles} onChange={(e) => update({ miles: Number(e.target.value) })} />
            <SelectField
              label="Carrier Type"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'enclosed', label: 'Enclosed' },
              ]}
              value={inputs.trailerType}
              onChange={(e) => update({ trailerType: e.target.value as 'open' | 'enclosed' })}
            />
          </div>
          
          <div className="bg-[var(--s3)] border border-[var(--b1)] rounded-[var(--r3)] p-3">
            <p className="text-xs text-[var(--t3)] mb-2 uppercase tracking-wider">Live Estimate</p>
            <div className="flex flex-col sm:flex-row justify-between text-sm gap-2">
              <div className="flex justify-between sm:flex-col gap-1">
                <span className="text-[var(--t2)]">Budget</span>
                <Mono className="text-[var(--t1)]">${transportEst.budget}</Mono>
              </div>
              <div className="flex justify-between sm:flex-col gap-1">
                <span className="text-[var(--t2)]">Standard</span>
                <Mono className="text-[var(--t1)]">${transportEst.standard}</Mono>
              </div>
              <div className="flex justify-between sm:flex-col gap-1">
                <span className="text-[var(--t2)]">Express</span>
                <Mono className="text-[var(--t1)]">${transportEst.express}</Mono>
              </div>
              <button 
                onClick={() => update({ transportCost: transportEst.standard })}
                className="mt-2 sm:mt-0 text-xs font-bold text-[var(--amber)] bg-[var(--amber-lo)] px-3 py-1.5 rounded-[var(--r2)] hover:bg-[var(--amber)] hover:text-[var(--s0)] transition-colors"
              >
                Apply ${transportEst.standard}
              </button>
            </div>
            <div className="mt-3">
              <Field label="Final Transport Cost ($)" type="number" value={inputs.transportCost} onChange={(e) => update({ transportCost: Number(e.target.value) })} />
            </div>
          </div>
        </Panel>

        {/* SALE */}
        <Panel>
          <h2 className="text-sm font-semibold text-[var(--t2)] uppercase tracking-wider mb-4">Sale</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Expected Sale Price ($)" type="number" value={inputs.salePrice} onChange={(e) => update({ salePrice: Number(e.target.value) })} />
            <Field label="Selling Fee ($)" type="number" value={inputs.sellingFee} onChange={(e) => update({ sellingFee: Number(e.target.value) })} />
          </div>
        </Panel>
      </div>

      {/* RIGHT COLUMN — Results */}
      <div className="space-y-4">
        
        {/* HERO RESULTS */}
        <Panel className="relative overflow-hidden flex flex-col items-center justify-center py-8">
          <div className="relative flex items-center justify-center w-32 h-32 mb-6">
            <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--b1)" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--amber)" strokeWidth="8" strokeDasharray={`${result.score * 2.82} 282`} className="transition-all duration-500 ease-out" />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-[var(--t1)]">{result.score}</span>
              <span className="text-[0.6rem] text-[var(--t3)] uppercase tracking-widest font-bold">Score</span>
            </div>
          </div>

          <p className="text-xs text-[var(--t3)] uppercase tracking-wider mb-1">Net Profit</p>
          <Mono className={cn('text-5xl font-black mb-6', result.profit > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]')}>
            {result.profit > 0 ? '+' : '-'}${Math.abs(result.profit).toLocaleString()}
          </Mono>

          <div className="w-full px-6 grid grid-cols-4 gap-2 text-center mb-6">
            <div>
              <p className="text-[0.65rem] text-[var(--t3)] uppercase tracking-wider mb-1">Total Cost</p>
              <Mono className="text-sm font-bold text-[var(--amber)]">${result.totalCost.toLocaleString()}</Mono>
            </div>
            <div>
              <p className="text-[0.65rem] text-[var(--t3)] uppercase tracking-wider mb-1">ROI</p>
              <Mono className="text-sm font-bold text-[var(--t1)]">{result.roi.toFixed(1)}%</Mono>
            </div>
            <div>
              <p className="text-[0.65rem] text-[var(--t3)] uppercase tracking-wider mb-1">$/Lot Day</p>
              <Mono className="text-sm font-bold text-[var(--t1)]">${inputs.dailyFloorRate}/day</Mono>
            </div>
            <div>
              <p className="text-[0.65rem] text-[var(--t3)] uppercase tracking-wider mb-1">Break-Even</p>
              <Mono className="text-sm font-bold text-[var(--t1)]">Day {result.breakEvenDay}</Mono>
            </div>
          </div>

          <div className="w-full px-6 mb-6">
            <div className="h-2 w-full rounded-full bg-[var(--s3)] overflow-hidden">
              <div 
                className={cn('h-full transition-all duration-500', result.roi > 20 ? 'bg-[var(--green)]' : result.roi > 0 ? 'bg-[var(--amber)]' : 'bg-[var(--red)]')} 
                style={{ width: `${Math.min(100, Math.max(0, result.roi))}%` }} 
              />
            </div>
          </div>

          {/* VERDICT BADGE */}
          <div className={cn('w-full px-6 py-4 rounded-[var(--r3)] border text-center', verdictConfig[result.verdict].bg, verdictConfig[result.verdict].border)}>
            <div className="flex items-center justify-center gap-3 mb-2">
              <p className={cn('text-3xl font-black', verdictConfig[result.verdict].color)}>{verdictConfig[result.verdict].label}</p>
              <p className={cn('text-sm font-bold uppercase tracking-wide', verdictConfig[result.verdict].color)}>— {verdictConfig[result.verdict].msg}</p>
            </div>
            <p className="text-sm text-[var(--t2)] leading-relaxed">
              <Mono className="font-bold">${Math.abs(result.profit).toLocaleString()}</Mono> net after all costs including <Mono>${inputs.transportCost.toLocaleString()}</Mono> transport. <Mono>{result.roi.toFixed(1)}%</Mono> ROI. Break-even by day {result.breakEvenDay} at <Mono>${inputs.dailyFloorRate}</Mono>/day floor.
            </p>
          </div>
        </Panel>

        {/* ASCII COST BREAKDOWN */}
        <Panel>
          <h3 className="text-sm font-semibold text-[var(--t2)] uppercase tracking-wider mb-4">Cost Breakdown</h3>
          <div className="font-[var(--fm)] text-xs space-y-2">
            {costRows.map((row) => {
              const percentage = result.totalCost > 0 ? (row.value / result.totalCost) * 100 : 0
              const blocks = Math.max(1, Math.round(percentage / 3))
              const bar = '█'.repeat(blocks)
              return (
                <div key={row.label} className="flex items-center">
                  <span className="w-20 text-[var(--t3)]">{row.label.padEnd(10, ' ')}</span>
                  <span className="w-16 text-right text-[var(--t2)]">${row.value.toLocaleString()}</span>
                  <span className="ml-3 text-[var(--amber)]">{bar}</span>
                  <span className="ml-2 text-[var(--t4)]">{percentage.toFixed(0)}%</span>
                </div>
              )
            })}
            <div className="border-t border-[var(--b1)] mt-2 pt-2 flex items-center text-[var(--t1)] font-bold">
              <span className="w-20">Total</span>
              <span className="w-16 text-right">${result.totalCost.toLocaleString()}</span>
            </div>
          </div>
        </Panel>

        {/* FLOORPLAN CLOCK WARNING */}
        {result.profit > 0 && (
          <Panel className="bg-[var(--olo)] border border-[rgba(249,115,22,.20)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⏱</span>
              <h3 className="text-sm font-bold text-[var(--orange)]">Floorplan Clock</h3>
            </div>
            <p className="text-sm text-[var(--t2)]">
              At <Mono>${inputs.dailyFloorRate}</Mono>/day carrying cost, this deal needs to close within <Mono>{Math.floor(result.profit / inputs.dailyFloorRate)}</Mono> days to remain profitable. Break-even lot day: <Mono>Day {result.breakEvenDay}</Mono>.
            </p>
          </Panel>
        )}

        {/* TITLE REQUIREMENTS */}
        <Panel>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-[var(--t2)] uppercase tracking-wider">Title Requirements</h3>
            <Tag color={titleRules.warning ? 'red' : 'green'}>{inputs.fromState} &rarr; {inputs.toState}</Tag>
          </div>
          {titleRules.warning && (
            <p className="text-sm text-[var(--red)] font-bold mb-2">⚠ Read Before Buying</p>
          )}
          <ul className="space-y-2">
            {titleRules.requirements.map((req, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-[var(--t2)]">
                <span className="text-[var(--t4)]">•</span>
                {req}
              </li>
            ))}
          </ul>
        </Panel>

        {/* ACTION BUTTONS */}
        <div className="grid grid-cols-3 gap-3">
          <Btn className="bg-[var(--s3)] text-[var(--t2)] hover:bg-[var(--s4)]">Save to Fleet</Btn>
          <Btn className="bg-[var(--s3)] text-[var(--t2)] hover:bg-[var(--s4)]">Add to Watchlist</Btn>
          <Btn className="bg-[var(--s3)] text-[var(--t2)] hover:bg-[var(--s4)]">Share Deal</Btn>
        </div>
      </div>
    </div>
  )
}
