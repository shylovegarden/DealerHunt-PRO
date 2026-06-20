'use client'

import { useState, useEffect } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Btn } from '@/components/shared/Btn'
import { DealCard } from '@/components/shared/DealCard'
import { Ico } from '@/components/shared/Ico'
import { Listing } from '@/lib/data/listings-service'

export default function ScanPage() {
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<Listing[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!scanning) return
    setResults([])
    setProgress(0)
    setError(null)

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          return 100
        }
        return p + 10
      })
    }, 300)

    fetch('/api/listings?hot=true&limit=20')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setResults([])
        } else {
          setResults(data.listings || [])
        }
      })
      .catch((err) => {
        setError(err.message)
        setResults([])
      })
      .finally(() => {
        clearInterval(interval)
        setScanning(false)
        setProgress(100)
      })

    return () => clearInterval(interval)
  }, [scanning])

  return (
    <div className="space-y-4">
      <Panel className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
            <Ico name="scan" className="text-[#F59E0B]" /> Live Scanner
          </h1>
          <p className="text-sm text-[#9898A8] mt-1">Scan sources for high-score opportunities in real time.</p>
        </div>
        <Btn
          loading={scanning}
          onClick={() => setScanning(true)}
          disabled={scanning}
          className="w-full md:w-auto"
        >
          {scanning ? 'Scanning...' : 'Start Scan'}
        </Btn>
      </Panel>

      {scanning && (
        <Panel>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#9898A8]">Scanning sources...</span>
            <span className="text-[#FAFAFA] font-mono">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#18181D] overflow-hidden">
            <div className="h-full bg-[#F59E0B] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </Panel>
      )}

      {error && !scanning && (
        <Panel className="text-center py-12 border border-[rgba(239,68,68,.20)] bg-[rgba(239,68,68,.10)]">
          <p className="text-[#EF4444]">Error: {error}</p>
        </Panel>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[#9898A8]">Found {results.length} opportunities</p>
          {results.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {!scanning && results.length === 0 && !error && (
        <Panel className="text-center py-16">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(245,158,11,.10)] border border-[rgba(245,158,11,.22)] text-[#F59E0B] mb-4">
            <Ico name="scan" size={24} />
          </div>
          <p className="text-[#FAFAFA] font-semibold">No active scan</p>
          <p className="text-sm text-[#9898A8] mt-1">Start a scan to surface high-score deals.</p>
        </Panel>
      )}
    </div>
  )
}
