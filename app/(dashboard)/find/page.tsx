'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Panel } from '@/components/shared/Panel'
import { SelectField } from '@/components/shared/Field'
import { DealCard } from '@/components/shared/DealCard'
import { Ico } from '@/components/shared/Ico'
import { Mono } from '@/components/shared/Mono'
import { Deal } from '@/lib/data/deals-service'
import { US_STATES } from '@/lib/utils/titleRules'
import { Btn } from '@/components/shared/Btn'

interface ArbitrageDashboard {
  homeState: string
  topRoutes: Array<{
    targetState: string
    route: string[]
    distance: number
    estimatedCost: number
    estimatedTime: number
  }>
  localDeals: Deal[]
  nationalArbitrage: Array<{
    deal: Deal
    arbitrage: any
  }>
}

export default function ArbitrageDashboardPage() {
  const [homeState, setHomeState] = useState('CA')
  const [data, setData] = useState<ArbitrageDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'national' | 'local'>('national')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/arbitrage?homeState=${homeState}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.error) throw new Error(resData.error)
        setData(resData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [homeState])

  return (
    <div className="space-y-4">
      {/* TOOL DOCK & COMMAND CENTER */}
      <Panel className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[rgba(16,185,129,.05)] border-[rgba(16,185,129,.15)]">
        <div>
          <h1 className="text-xl font-bold text-[#FAFAFA] flex items-center gap-2">
            <Ico name="map" className="text-[#10B981]" /> National Arbitrage Hub
          </h1>
          <p className="text-sm text-[#9898A8] mt-1">Discover high-ROI transport routes and local deals instantly.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <SelectField
            options={US_STATES.map((s: string) => ({ value: s, label: s }))}
            value={homeState}
            onChange={(e) => setHomeState(e.target.value)}
            className="w-32"
          />
          <Link href="/scan" className="flex-1 md:flex-none">
            <Btn variant="primary" className="w-full">
              <Ico name="scan" size={16} /> Live Scanner
            </Btn>
          </Link>
        </div>
      </Panel>

      {loading ? (
        <Panel className="text-center py-20">
          <div className="animate-pulse flex flex-col items-center">
            <Ico name="refresh" className="text-[#10B981] animate-spin mb-4" size={32} />
            <p className="text-[#9898A8]">Calculating national transport routes & market demand...</p>
          </div>
        </Panel>
      ) : error ? (
        <Panel className="text-center py-12 border border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
          <p className="text-[#EF4444]">Error: {error}</p>
        </Panel>
      ) : data ? (
        <>
          {/* TOP ARBITRAGE ROUTES WIDGET */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {data.topRoutes.slice(0, 4).map((route, i) => (
              <Panel key={i} className="flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#9898A8] uppercase tracking-wider">Top Route</span>
                  <div className="h-6 w-6 rounded bg-[rgba(16,185,129,.10)] text-[#10B981] flex items-center justify-center">
                    <Ico name="truck" size={12} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-lg font-black text-[#FAFAFA] mb-1">
                  {route.route[0]} <Ico name="arrow" size={14} className="rotate-90 text-[#62627A]" /> {route.route[1]}
                </div>
                <div className="text-xs text-[#9898A8] flex justify-between">
                  <span>{route.distance} mi</span>
                  <span className="text-[#F59E0B] font-mono">${route.estimatedCost} est</span>
                </div>
              </Panel>
            ))}
          </div>

          {/* SMART DEAL GROUPS */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setActiveTab('national')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'national' ? 'bg-[rgba(16,185,129,.15)] text-[#10B981] border border-[rgba(16,185,129,.30)]' : 'text-[#9898A8] hover:bg-[#18181D]'
              }`}
            >
              National Arbitrage ({data.nationalArbitrage.length})
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'local' ? 'bg-[rgba(16,185,129,.15)] text-[#10B981] border border-[rgba(16,185,129,.30)]' : 'text-[#9898A8] hover:bg-[#18181D]'
              }`}
            >
              Local in {homeState} ({data.localDeals.length})
            </button>
          </div>

          {activeTab === 'national' && (
            <div className="space-y-4">
              {data.nationalArbitrage.length === 0 ? (
                <Panel className="text-center py-12">
                  <p className="text-[#9898A8]">No highly profitable out-of-state deals found to transport to {homeState}. Try another state or run the scanner.</p>
                </Panel>
              ) : (
                data.nationalArbitrage.map((item) => (
                  <div key={item.deal.id} className="relative">
                    <div className="absolute -left-2 top-4 w-1 h-12 bg-[#10B981] rounded-r-full z-10" />
                    <div className="mb-1 ml-2 text-xs font-bold text-[#10B981] flex items-center gap-2">
                      <span>Import from {item.deal.locationState}</span>
                      <span>•</span>
                      <span>Est. Net Profit: <Mono>${item.arbitrage.arbitrage.potentialProfit.toLocaleString()}</Mono></span>
                      <span>•</span>
                      <span className="text-[#F59E0B]">Transport: ${item.arbitrage.arbitrage.transportCost.toLocaleString()}</span>
                    </div>
                    <DealCard deal={item.deal} />
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'local' && (
            <div className="space-y-3">
              {data.localDeals.length === 0 ? (
                <Panel className="text-center py-12">
                  <p className="text-[#9898A8]">No deals found currently located in {homeState}.</p>
                </Panel>
              ) : (
                data.localDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
