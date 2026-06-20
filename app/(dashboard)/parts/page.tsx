'use client'

import { useState, useMemo } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'
import { Mono } from '@/components/shared/Mono'
import { Tag } from '@/components/shared/Tag'

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
  const [salvageCost, setSalvageCost] = useState(4500)
  const [selected, setSelected] = useState<string[]>(['Engine', 'Transmission', 'Wheels/Tires', 'Cat/Exhaust'])

  const toggle = (name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const { partsValue, net, roi } = useMemo(() => {
    const partsValue = PARTS.filter((p) => selected.includes(p.name)).reduce((acc, p) => acc + p.value, 0)
    const net = partsValue - salvageCost
    const roi = salvageCost > 0 ? (net / salvageCost) * 100 : 0
    return { partsValue, net, roi }
  }, [selected, salvageCost])

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Parts</h1>
        <p className="text-sm text-[#9898A8] mt-1">Teardown ROI calculator for salvage inventory.</p>
      </Panel>

      <Panel>
        <Field
          label="Salvage Cost"
          type="number"
          value={salvageCost}
          onChange={(e) => setSalvageCost(Number(e.target.value))}
        />
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">Select Parts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PARTS.map((part) => (
            <button
              key={part.name}
              onClick={() => toggle(part.name)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                selected.includes(part.name)
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
          <p className="text-xs text-[#62627A] uppercase">Parts Value</p>
          <Mono className="text-2xl font-bold text-[#FAFAFA]">${partsValue.toLocaleString()}</Mono>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-[#62627A] uppercase">Net Profit</p>
          <Mono className={`text-2xl font-bold ${net >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {net >= 0 ? '+' : '-'}${Math.abs(net).toLocaleString()}
          </Mono>
        </Panel>
        <Panel className="text-center">
          <p className="text-xs text-[#62627A] uppercase">ROI</p>
          <Mono className="text-2xl font-bold text-[#F59E0B]">{roi.toFixed(1)}%</Mono>
        </Panel>
      </div>

      <Btn className="w-full" disabled={selected.length === 0}>Save Teardown</Btn>
    </div>
  )
}
