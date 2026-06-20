'use client'

import { useState, useMemo } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field } from '@/components/shared/Field'
import { Mono } from '@/components/shared/Mono'

const LENDERS = [
  { name: 'Dealer Floorplan A', rate: 0.045, setup: 0 },
  { name: 'Floorplan Capital', rate: 0.052, setup: 299 },
  { name: 'NextGear Capital', rate: 0.049, setup: 499 },
]

export default function FinancePage() {
  const [amount, setAmount] = useState(100000)
  const [days, setDays] = useState(30)

  const results = useMemo(() => {
    return LENDERS.map((lender) => {
      const daily = (amount * lender.rate) / 365
      const interest = Math.round(daily * days)
      const total = amount + interest + lender.setup
      return { ...lender, interest, total, daily }
    })
  }, [amount, days])

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Finance</h1>
        <p className="text-sm text-[#9898A8] mt-1">Compare floorplan carrying costs across lenders.</p>
      </Panel>

      <Panel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Line Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <Field
            label="Holding Days"
            type="number"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
      </Panel>

      <div className="space-y-3">
        {results.map((lender) => (
          <Panel key={lender.name} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[#FAFAFA]">{lender.name}</p>
              <p className="text-xs text-[#62627A]">{(lender.rate * 100).toFixed(1)}% · ${lender.setup} setup</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#62627A] uppercase">Total Cost</p>
              <Mono className="text-xl font-bold text-[#F59E0B]">${lender.interest.toLocaleString()}</Mono>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}
