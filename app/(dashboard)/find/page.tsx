'use client'

import { useState, useMemo } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field, SelectField } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'
import { DealCard } from '@/components/shared/DealCard'
import { MOCK_DEALS } from '@/lib/utils/mockDeals'

export default function FindPage() {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [minScore, setMinScore] = useState('all')

  const filtered = useMemo(() => {
    return MOCK_DEALS.filter((deal) => {
      const matchesQuery = `${deal.year} ${deal.make} ${deal.model} ${deal.trim}`.toLowerCase().includes(query.toLowerCase())
      const matchesSource = source === 'all' || deal.source === source
      const matchesScore = minScore === 'all' || deal.score >= parseInt(minScore, 10)
      return matchesQuery && matchesSource && matchesScore
    })
  }, [query, source, minScore])

  const sources = ['all', ...Array.from(new Set(MOCK_DEALS.map((d) => d.source)))]
  const stats = useMemo(() => {
    const total = filtered.length
    const avgProfit = total ? Math.round(filtered.reduce((acc, d) => acc + d.profit, 0) / total) : 0
    const hot = filtered.filter((d) => d.hot).length
    return { total, avgProfit, hot }
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Panel className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#62627A] uppercase tracking-wider">Deals</p>
            <p className="text-2xl font-bold text-[#FAFAFA]">{stats.total}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[rgba(245,158,11,.10)] border border-[rgba(245,158,11,.22)] flex items-center justify-center text-[#F59E0B]">✦</div>
        </Panel>
        <Panel className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#62627A] uppercase tracking-wider">Avg Profit</p>
            <p className="text-2xl font-bold text-[#10B981]">+${stats.avgProfit.toLocaleString()}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[rgba(16,185,129,.10)] border border-[rgba(16,185,129,.20)] flex items-center justify-center text-[#10B981]">↗</div>
        </Panel>
        <Panel className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#62627A] uppercase tracking-wider">Hot</p>
            <p className="text-2xl font-bold text-[#EF4444]">{stats.hot}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[rgba(239,68,68,.10)] border border-[rgba(239,68,68,.20)] flex items-center justify-center text-[#EF4444]">●</div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Field
              placeholder="Search make, model, VIN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <SelectField
            options={sources.map((s) => ({ value: s, label: s === 'all' ? 'All Sources' : s }))}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full sm:w-40"
          />
          <SelectField
            options={[
              { value: 'all', label: 'Any Score' },
              { value: '80', label: '80+' },
              { value: '70', label: '70+' },
              { value: '60', label: '60+' },
            ]}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="w-full sm:w-40"
          />
          <Btn variant="ghost" className="w-full sm:w-auto" onClick={() => { setQuery(''); setSource('all'); setMinScore('all') }}>
            Reset
          </Btn>
        </div>
      </Panel>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Panel className="text-center py-12">
            <p className="text-[#9898A8]">No deals match your filters.</p>
          </Panel>
        ) : (
          filtered.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  )
}
