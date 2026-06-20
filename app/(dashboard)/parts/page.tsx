'use client'

import { useState, useEffect } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'
import { Mono } from '@/components/shared/Mono'
import { InventoryItem } from '@/lib/data/inventory-service'

const PARTS = [
  { name: 'Engine', value: 4200 },
  { name: 'Transmission', value: 2800 },
  { name: 'Doors (x4)', value: 1200 },
  { name: 'Wheels/Tires', value: 900 },
  { name: 'Seats', value: 650 },
  { name: 'Electronics', value: 1100 },
  { name: 'Cat/Exhaust', value: 850 },
  { name: 'Body Panels', value: 700 },
]

export default function PartsPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [selectedParts, setSelectedParts] = useState<string[]>(['Engine', 'Transmission', 'Wheels/Tires', 'Cat/Exhaust'])

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
          const items = (data.items || []) as InventoryItem[]
          const teardown = items.filter((i) => ['parts_only', 'salvage_title'].includes(i.condition))
          setInventory(teardown)
          if (teardown.length > 0) setSelectedVehicle(teardown[0].id)
        }
      })
      .catch((err) => {
        setError(err.message)
        setInventory([])
      })
      .finally(() => setLoading(false))
  }, [])

  const vehicle = inventory.find((i) => i.id === selectedVehicle)
  const salvageCost = vehicle?.totalCost || 0
  const partsValue = PARTS.filter((p) => selectedParts.includes(p.name)).reduce((acc, p) => acc + p.value, 0)
  const net = partsValue - salvageCost
  const roi = salvageCost > 0 ? (net / salvageCost) * 100 : 0

  const togglePart = (name: string) => {
    setSelectedParts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Parts</h1>
        <p className="text-sm text-[#9898A8] mt-1">Teardown ROI calculator for salvage inventory.</p>
      </Panel>

      {loading && (
        <Panel className="text-center py-12">
          <p className="text-[#9898A8]">Loading salvage inventory...</p>
        </Panel>
      )}

      {error && !loading && (
        <Panel className="text-center py-12 border border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
          <p className="text-[#EF4444]">Error: {error}</p>
        </Panel>
      )}

      {!loading && !error && (
        <>
          <Panel>
            <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">1. Select Salvage Vehicle</h2>
            {inventory.length === 0 ? (
              <p className="text-sm text-[#9898A8]">No salvage vehicles in inventory. Mark a vehicle as parts_only or salvage_title in Fleet.</p>
            ) : (
              <div className="space-y-2">
                {inventory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedVehicle(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      selectedVehicle === item.id
                        ? 'border-[rgba(245,158,11,.22)] bg-[rgba(245,158,11,.10)]'
                        : 'border-[rgba(255,255,255,.06)] hover:border-[rgba(255,255,255,.10)]'
                    }`}
                  >
                    <span className="text-sm text-[#FAFAFA]">
                      {item.year} {item.make} {item.model}
                    </span>
                    <span className="text-sm font-mono text-[#9898A8]">${item.totalCost.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">2. Select Parts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PARTS.map((part) => (
                <button
                  key={part.name}
                  onClick={() => togglePart(part.name)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    selectedParts.includes(part.name)
                      ? 'border-[rgba(245,158,11,.22)] bg-[rgba(245,158,11,.10)]'
                      : 'border-[rgba(255,255,255,.06)] hover:border-[rgba(255,255,255,.10)]'
                  }`}
                >
                  <span className="text-sm text-[#FAFAFA]">{part.name}</span>
                  <Mono className="text-sm text-[#9898A8]">${part.value.toLocaleString()}</Mono>
                </button>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Panel className="text-center">
              <p className="text-xs text-[#62627A] uppercase">Salvage Cost</p>
              <Mono className="text-2xl font-bold text-[#FAFAFA]">${salvageCost.toLocaleString()}</Mono>
            </Panel>
            <Panel className="text-center">
              <p className="text-xs text-[#62627A] uppercase">Parts Value</p>
              <Mono className="text-2xl font-bold text-[#FAFAFA]">${partsValue.toLocaleString()}</Mono>
            </Panel>
            <Panel className="text-center">
              <p className="text-xs text-[#62627A] uppercase">Net / ROI</p>
              <Mono className={`text-2xl font-bold ${net >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {net >= 0 ? '+' : '-'}${Math.abs(net).toLocaleString()} · {roi.toFixed(0)}%
              </Mono>
            </Panel>
          </div>

          <Btn className="w-full" disabled={!vehicle || selectedParts.length === 0}>Save Teardown</Btn>
        </>
      )}
    </div>
  )
}
