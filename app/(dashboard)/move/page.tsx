'use client'

import { useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Field, SelectField } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'
import { Mono } from '@/components/shared/Mono'
import { US_STATES } from '@/lib/utils/titleRules'

export default function MovePage() {
  const [miles, setMiles] = useState(1400)
  const [trailer, setTrailer] = useState<'open' | 'enclosed'>('open')
  const [fromState, setFromState] = useState('TX')
  const [toState, setToState] = useState('CA')
  const [quote, setQuote] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getQuote = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/quote?miles=${miles}&trailer=${trailer}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setQuote(null)
      } else {
        setQuote(data.quote)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setQuote(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Move</h1>
        <p className="text-sm text-[#9898A8] mt-1">Get instant transport quotes and title-route checks.</p>
      </Panel>

      <Panel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <SelectField
            label="From State"
            options={US_STATES.map((s) => ({ value: s, label: s }))}
            value={fromState}
            onChange={(e) => setFromState(e.target.value)}
          />
          <SelectField
            label="To State"
            options={US_STATES.map((s) => ({ value: s, label: s }))}
            value={toState}
            onChange={(e) => setToState(e.target.value)}
          />
          <Field
            label="Distance (miles)"
            type="number"
            value={miles}
            onChange={(e) => setMiles(Number(e.target.value))}
          />
          <SelectField
            label="Trailer Type"
            options={[
              { value: 'open', label: 'Open' },
              { value: 'enclosed', label: 'Enclosed' },
            ]}
            value={trailer}
            onChange={(e) => setTrailer(e.target.value as 'open' | 'enclosed')}
          />
        </div>
        <Btn loading={loading} onClick={getQuote} className="w-full">Get Quote</Btn>
      </Panel>

      {error && (
        <Panel className="text-center py-6 border border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
          <p className="text-[#EF4444]">Error: {error}</p>
        </Panel>
      )}

      {quote !== null && !error && (
        <Panel className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#62627A] uppercase tracking-wider">Estimated Transport</p>
            <Mono className="text-3xl font-bold text-[#F59E0B]">${quote.toLocaleString()}</Mono>
          </div>
          <div className="text-right text-sm text-[#9898A8]">
            <p>{miles.toLocaleString()} miles</p>
            <p className="capitalize">{trailer} trailer</p>
          </div>
        </Panel>
      )}
    </div>
  )
}
