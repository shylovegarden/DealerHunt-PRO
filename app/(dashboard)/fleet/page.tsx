'use client'

import { useState, useEffect } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Tag } from '@/components/shared/Tag'
import { Mono } from '@/components/shared/Mono'
import { InventoryItem } from '@/lib/data/inventory-service'

const STAGES = ['transport', 'recon', 'listed', 'sold'] as const
const STAGE_LABELS: Record<string, string> = {
  transport: 'In Transit',
  recon: 'Recon',
  listed: 'Listed',
  sold: 'Sold',
}

export default function FleetPage() {
  const [fleet, setFleet] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // TODO: replace with real authenticated dealerId once auth is wired
  const dealerId = process.env.NEXT_PUBLIC_DEMO_DEALER_ID || 'demo-dealer'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/inventory?dealerId=${dealerId}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setFleet([])
        } else {
          setFleet(data.items || [])
        }
      })
      .catch((err) => {
        setError(err.message)
        setFleet([])
      })
      .finally(() => setLoading(false))
  }, [])

  const advance = async (id: string) => {
    const item = fleet.find((f) => f.id === id)
    if (!item) return

    const stageOrder = ['acquired', 'transport', 'recon', 'listed', 'offer', 'sold', 'wholesale']
    const idx = stageOrder.indexOf(item.stage)
    const next = stageOrder[idx + 1]
    if (!next) return

    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stage: next }),
      })
      const data = await res.json()
      if (data.item) {
        setFleet((prev) => prev.map((f) => (f.id === id ? data.item : f)))
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const daysOnFloor = (item: InventoryItem) => {
    const ms = Date.now() - item.floorDate.getTime()
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
  }

  const [activeTab, setActiveTab] = useState<typeof STAGES[number]>('transport')

  return (
    <div className="space-y-4">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGES.map((stage) => {
          const count = fleet.filter((f) => f.stage === stage).length
          const totalCost = fleet.filter((f) => f.stage === stage).reduce((acc, f) => acc + f.holdingCost, 0)
          const isTabActive = activeTab === stage
          return (
            <button
              key={stage}
              onClick={() => setActiveTab(stage)}
              className={`panel p-4 text-center border transition-all md:pointer-events-none flex flex-col items-center justify-center ${
                isTabActive ? 'border-[#F59E0B] bg-[rgba(245,158,11,.05)] md:bg-[#111115] md:border-[rgba(255,255,255,.06)]' : 'border-[rgba(255,255,255,.06)] bg-[#111115]'
              }`}
            >
              <p className="text-[10px] text-[#62627A] uppercase tracking-wider font-semibold mb-1">{STAGE_LABELS[stage]}</p>
              <p className="text-xl font-black text-[#FAFAFA]">{count}</p>
              <p className="text-[10px] text-[#9898A8] mt-0.5">Carry ${totalCost.toLocaleString()}</p>
              <span className="md:hidden block mt-2 text-[9px] text-[#F59E0B] font-bold">
                {isTabActive ? 'Active View' : 'Tap to View'}
              </span>
            </button>
          )
        })}
      </div>

      {loading && (
        <Panel className="text-center py-12">
          <p className="text-[#9898A8]">Loading fleet...</p>
        </Panel>
      )}

      {error && !loading && (
        <Panel className="text-center py-12 border border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
          <p className="text-[#EF4444]">Error: {error}</p>
        </Panel>
      )}

      {/* Grid columns: shown on desktop. On mobile, show only activeTab column */}
      {!loading && !error && (
        <>
          {/* Mobile view list */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,.06)] pb-2 mb-2">
              <h3 className="text-sm font-bold text-[#FAFAFA]">{STAGE_LABELS[activeTab]}</h3>
              <Tag color={activeTab === 'sold' ? 'green' : activeTab === 'listed' ? 'amber' : 'blue'}>
                {fleet.filter((f) => f.stage === activeTab).length} Units
              </Tag>
            </div>
            {fleet.filter((f) => f.stage === activeTab).length === 0 ? (
              <Panel className="text-center py-10">
                <p className="text-xs text-[#62627A]">No units in {STAGE_LABELS[activeTab]}</p>
              </Panel>
            ) : (
              fleet
                .filter((f) => f.stage === activeTab)
                .map((item) => (
                  <Panel key={item.id} className="space-y-3 p-4 bg-[#0C0C0F]">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm text-[#FAFAFA]">
                          {item.year} {item.make} {item.model}
                        </p>
                        <p className="text-xs text-[#62627A] mt-1">
                          Floorplan: <Mono className="text-[#FAFAFA] font-medium">{daysOnFloor(item)} days</Mono> · carrying <Mono className="text-[#10B981] font-semibold">${item.holdingCost.toLocaleString()}</Mono>
                        </p>
                      </div>
                      <Tag color={item.marketValue && item.marketValue > item.totalCost ? 'green' : 'amber'}>
                        ${(item.marketValue || item.totalCost).toLocaleString()}
                      </Tag>
                    </div>
                    {activeTab !== 'sold' && (
                      <button
                        onClick={() => advance(item.id)}
                        className="w-full text-xs font-bold text-[#F59E0B] hover:text-[#07070A] py-2 rounded-xl border border-[rgba(245,158,11,.22)] hover:bg-[#F59E0B] transition-all duration-200"
                      >
                        Advance to Next Stage
                      </button>
                    )}
                  </Panel>
                ))
            )}
          </div>

          {/* Desktop view grid columns */}
          <div className="hidden md:grid grid-cols-4 gap-4">
            {STAGES.map((stage) => (
              <div key={stage} className="space-y-3">
                <div className="flex items-center justify-between border-b border-[rgba(255,255,255,.06)] pb-2">
                  <h3 className="text-sm font-semibold text-[#D1D1DC]">{STAGE_LABELS[stage]}</h3>
                  <Tag color={stage === 'sold' ? 'green' : stage === 'listed' ? 'amber' : 'blue'}>
                    {fleet.filter((f) => f.stage === stage).length}
                  </Tag>
                </div>
                {fleet
                  .filter((f) => f.stage === stage)
                  .map((item) => (
                    <Panel key={item.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-[#FAFAFA]">
                            {item.year} {item.make} {item.model}
                          </p>
                          <p className="text-xs text-[#62627A]">
                            {daysOnFloor(item)} days · <Mono>${item.holdingCost.toLocaleString()}</Mono> floorplan
                          </p>
                        </div>
                        <Tag color={item.marketValue && item.marketValue > item.totalCost ? 'green' : 'amber'}>
                          ${(item.marketValue || item.totalCost).toLocaleString()}
                        </Tag>
                      </div>
                      {stage !== 'sold' && (
                        <button
                          onClick={() => advance(item.id)}
                          className="w-full text-xs font-medium text-[#F59E0B] hover:text-[#FBBF24] py-2 rounded-lg border border-[rgba(245,158,11,.22)] hover:bg-[rgba(245,158,11,.10)] transition-colors"
                        >
                          Advance →
                        </button>
                      )}
                    </Panel>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
