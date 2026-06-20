'use client'

import { useState, useEffect } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field } from '@/components/shared/Field'
import { Mono } from '@/components/shared/Mono'
import { InventoryItem } from '@/lib/data/inventory-service'

const LENDERS = [
  { name: 'Dealer Floorplan A', rate: 0.045, setup: 0 },
  { name: 'Floorplan Capital', rate: 0.052, setup: 299 },
  { name: 'NextGear Capital', rate: 0.049, setup: 499 },
]

export default function FinancePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const dealerId = process.env.NEXT_PUBLIC_DEMO_DEALER_ID || 'demo-dealer'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/inventory?dealerId=${dealerId}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setInventory([])
        } else {
          setInventory(data.items || [])
        }
      })
      .catch((err) => {
        setError(err.message)
        setInventory([])
      })
      .finally(() => setLoading(false))
  }, [])

  const floorplanValue = inventory.reduce((acc, item) => acc + item.totalCost, 0)
  const holdingCost = inventory.reduce((acc, item) => acc + item.holdingCost, 0)

  const results = LENDERS.map((lender) => {
    const daily = (floorplanValue * lender.rate) / 365
    const interest = Math.round(daily * days)
    return { ...lender, interest }
  })

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Finance</h1>
        <p className="text-sm text-[#9898A8] mt-1">Compare floorplan carrying costs across lenders.</p>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Panel className="text-center">
          <p className="text-xs text-[#62627A] uppercase">Units</p>
          <Mono className="text-2xl font-bold text-[#FAFAFA]">{inventory.length}</Mono>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-[#62627A] uppercase">Floorplan Value</p>
          <Mono className="text-2xl font-bold text-[#F59E0B]">${floorplanValue.toLocaleString()}</Mono>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-[#62627A] uppercase">Current Holding Cost</p>
          <Mono className="text-2xl font-bold text-[#EF4444]">${holdingCost.toLocaleString()}</Mono>
        </Panel>
      </div>

      <Panel>
        <Field
          label="Projected Holding Days"
          type="number"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </Panel>

      {loading && (
        <Panel className="text-center py-12">
          <p className="text-[#9898A8]">Loading inventory...</p>
        </Panel>
      )}

      {error && !loading && (
        <Panel className="text-center py-12 border border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
          <p className="text-[#EF4444]">Error: {error}</p>
        </Panel>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {results.map((lender) => (
            <Panel key={lender.name} className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#FAFAFA]">{lender.name}</p>
                <p className="text-xs text-[#62627A]">{(lender.rate * 100).toFixed(1)}% · ${lender.setup} setup</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#62627A] uppercase">{days}-Day Cost</p>
                <Mono className="text-xl font-bold text-[#F59E0B]">${lender.interest.toLocaleString()}</Mono>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
