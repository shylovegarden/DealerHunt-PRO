'use client'

import { useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Tag } from '@/components/shared/Tag'
import { Mono } from '@/components/shared/Mono'

const STAGES = ['In Transit', 'Recon', 'Listed', 'Sold'] as const

const FLEET = [
  { id: '1', year: 2021, make: 'Ford', model: 'F-150', stage: 'In Transit', days: 2, cost: 70, profit: 5700 },
  { id: '2', year: 2022, make: 'Tesla', model: 'Model 3', stage: 'Recon', days: 5, cost: 175, profit: 6200 },
  { id: '3', year: 2019, make: 'Toyota', model: 'Tacoma', stage: 'Listed', days: 12, cost: 420, profit: 4500 },
  { id: '4', year: 2020, make: 'Chevrolet', model: 'Silverado', stage: 'Sold', days: 18, cost: 630, profit: 5300 },
  { id: '5', year: 2018, make: 'Honda', model: 'Civic', stage: 'Listed', days: 8, cost: 280, profit: 3900 },
]

export default function FleetPage() {
  const [fleet, setFleet] = useState(FLEET)

  const advance = (id: string) => {
    setFleet((prev) =>
      prev.map((item) => {
        const idx = STAGES.indexOf(item.stage as any)
        const next = STAGES[idx + 1]
        if (item.id === id && next) {
          return { ...item, stage: next }
        }
        return item
      })
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGES.map((stage) => {
          const count = fleet.filter((f) => f.stage === stage).length
          const totalCost = fleet.filter((f) => f.stage === stage).reduce((acc, f) => acc + f.cost, 0)
          return (
            <Panel key={stage} className="text-center">
              <p className="text-xs text-[#62627A] uppercase tracking-wider">{stage}</p>
              <p className="text-2xl font-bold text-[#FAFAFA]">{count}</p>
              <p className="text-xs text-[#9898A8] mt-1">Carry ${totalCost.toLocaleString()}</p>
            </Panel>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAGES.map((stage) => (
          <div key={stage} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#D1D1DC]">{stage}</h3>
              <Tag color={stage === 'Sold' ? 'green' : stage === 'Listed' ? 'amber' : 'blue'}>
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
                        {item.days} days · <Mono>${item.cost.toLocaleString()}</Mono> floorplan
                      </p>
                    </div>
                    <Tag color={item.profit > 5000 ? 'green' : 'amber'}>{item.profit > 0 ? '+' : ''}${item.profit.toLocaleString()}</Tag>
                  </div>
                  {stage !== 'Sold' && (
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
    </div>
  )
}
