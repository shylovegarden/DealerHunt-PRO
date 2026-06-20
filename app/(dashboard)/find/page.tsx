'use client'

import { useState, useEffect, useMemo } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field, SelectField } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'
import { DealCard } from '@/components/shared/DealCard'
import { Listing } from '@/lib/data/listings-service'

export default function FindPage() {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [minScore, setMinScore] = useState('all')
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (source !== 'all') params.set('source', source)
    if (minScore !== 'all') params.set('minScore', minScore)
    if (query.trim()) params.set('search', query.trim())
    params.set('limit', '50')

    setLoading(true)
    setError(null)

    fetch(`/api/listings?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setListings([])
        } else {
          setListings(data.listings || [])
        }
      })
      .catch((err) => {
        setError(err.message)
        setListings([])
      })
      .finally(() => setLoading(false))
  }, [query, source, minScore])

  const sources = useMemo(() => {
    const all = new Set<string>()
    listings.forEach((l) => all.add(l.source))
    return ['all', ...Array.from(all).sort()]
  }, [listings])

  const stats = useMemo(() => {
    const total = listings.length
    const avgProfit = total ? Math.round(listings.reduce((acc, d) => acc + d.profitEstimate, 0) / total) : 0
    const hot = listings.filter((d) => (d.profitScore ?? 0) >= 80).length
    return { total, avgProfit, hot }
  }, [listings])

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

      {loading && (
        <Panel className="text-center py-12">
          <p className="text-[#9898A8]">Loading deals...</p>
        </Panel>
      )}

      {error && !loading && (
        <Panel className="text-center py-12 border border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
          <p className="text-[#EF4444]">Error: {error}</p>
        </Panel>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {listings.length === 0 ? (
            <Panel className="text-center py-12">
              <p className="text-[#9898A8]">No deals found. Start a scan or ingest listings.</p>
            </Panel>
          ) : (
            listings.map((deal) => <DealCard key={deal.id} deal={deal} />)
          )}
        </div>
      )}
    </div>
  )
}
