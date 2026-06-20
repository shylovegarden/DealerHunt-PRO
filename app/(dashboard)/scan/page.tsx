'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Btn } from '@/components/shared/Btn'
import { Field, SelectField } from '@/components/shared/Field'
import { Tag } from '@/components/shared/Tag'
import { Mono } from '@/components/shared/Mono'
import { Ico } from '@/components/shared/Ico'
import { ALL_VEHICLE_SOURCES, PARTS_SOURCES, Source } from '@/lib/utils/sources'
import { cn } from '@/lib/utils'
import { Deal } from '@/lib/data/deals-service'
import { US_STATES } from '@/lib/utils/titleRules'

// Simulated scan log lines
const MOCK_LOGS = [
  '[SYS] Initializing Scan Engine...',
  '[SYS] Connecting to 64 active sources...',
  '[OK] Copart: Connected (125,402 lots active)',
  '[OK] IAA: Connected (84,102 lots active)',
  '[OK] Craigslist: 50 city nodes active',
  '[OK] Facebook: 50 city nodes active',
  '[WARN] Manheim: Rate limited, switching proxy...',
  '[OK] Manheim: Connected',
  '[SYS] Ready for query.',
]

export default function ScanPage() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'vehicles' | 'parts'>('vehicles')
  const [scanning, setScanning] = useState(false)
  const [logs, setLogs] = useState<string[]>(MOCK_LOGS)
  const [results, setResults] = useState<any[]>([])
  const terminalRef = useRef<HTMLDivElement>(null)

  // Filters
  const [minProfit, setMinProfit] = useState('1k')
  const [titleType, setTitleType] = useState('all')
  const [damage, setDamage] = useState('any')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [state, setState] = useState('TX')
  const [sort, setSort] = useState('profit')

  const sources = activeTab === 'vehicles' ? ALL_VEHICLE_SOURCES : PARTS_SOURCES

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  const runScan = () => {
    if (!search) return
    setScanning(true)
    setResults([])
    setLogs((prev) => [...prev, `[QUERY] Starting global scan for: "${search}" near ${state}`])

    let step = 0
    const interval = setInterval(() => {
      step++
      if (step === 1) setLogs((prev) => [...prev, `[SCAN] Querying Salvage Auctions...`])
      if (step === 3) setLogs((prev) => [...prev, `[MATCH] Found 2019 Ford F-150 at Copart TX (+ $4.2k est)`])
      if (step === 5) setLogs((prev) => [...prev, `[SCAN] Querying Private Deals (CL/FB)...`])
      if (step === 7) setLogs((prev) => [...prev, `[MATCH] Found 2018 F-150 Lariat on FB Marketplace TX (+ $3.1k est)`])
      if (step === 9) setLogs((prev) => [...prev, `[SCAN] Querying Wholesale (Manheim/ADESA)...`])
      if (step === 11) {
        setLogs((prev) => [...prev, `[DONE] Scan complete. 42 results found. Filtering...`])
        clearInterval(interval)
        setScanning(false)
        
        // Mock results based on the exact spec card
        setResults([
          {
            id: 'mock1',
            source: 'Copart',
            type: 'SALVAGE',
            score: 87,
            year: 2019,
            make: 'Ford',
            model: 'F-150 XLT 4WD',
            dealer: 'Copart Dallas',
            city: 'Dallas',
            state: 'TX',
            miles: 78000,
            ask: 13200,
            mmr: 19400,
            profit: 6200,
            repair: 0,
            title: 'Clean Title',
            ends: '2h 14m'
          },
          {
            id: 'mock2',
            source: 'Facebook',
            type: 'PRIVATE',
            score: 74,
            year: 2018,
            make: 'Ford',
            model: 'F-150 Lariat',
            dealer: 'Private Seller',
            city: 'Houston',
            state: 'TX',
            miles: 102000,
            ask: 18500,
            mmr: 23000,
            profit: 3100,
            repair: 900,
            title: 'Clean Title',
            ends: 'Listed 2d ago'
          }
        ])
      }
    }, 600)
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-fadeUp pb-24">
      
      {/* SEARCH BAR */}
      <Panel className="flex flex-col sm:flex-row gap-3 p-4 items-center bg-[var(--s2)] sticky top-0 z-10 border-b border-[var(--b1)]">
        <div className="flex-1 w-full relative">
          <input
            type="text"
            className="w-full bg-[var(--s3)] border border-[var(--b1)] rounded-[var(--r2)] py-3 px-4 text-[var(--t1)] outline-none focus:border-[var(--amber)] focus:ring-1 focus:ring-[var(--amber)] transition-all placeholder-[var(--t4)]"
            placeholder='Make/model, VIN, city... "F-150 Dallas" · "Tesla salvage TX"'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runScan()}
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--t3)] hover:text-[var(--amber)] transition-colors">
            <Ico name="camera" size={20} />
          </button>
        </div>
        <button 
          onClick={runScan}
          disabled={scanning || !search}
          className="w-full sm:w-auto bg-[var(--amber)] text-[var(--s0)] font-bold py-3 px-6 rounded-[var(--r2)] hover:bg-[var(--amber-d)] disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
        >
          {scanning ? 'SCANNING...' : 'SCAN ALL'}
        </button>
      </Panel>

      {/* SOURCE TABS & GRID */}
      {!results.length && !scanning && (
        <>
          <div className="flex gap-4 border-b border-[var(--b1)] px-1">
            <button
              onClick={() => setActiveTab('vehicles')}
              className={cn('pb-3 text-sm font-semibold uppercase tracking-wider transition-all', activeTab === 'vehicles' ? 'text-[var(--amber)] border-b-2 border-[var(--amber)]' : 'text-[var(--t4)] hover:text-[var(--t2)]')}
            >
              Vehicles ({ALL_VEHICLE_SOURCES.length})
            </button>
            <button
              onClick={() => setActiveTab('parts')}
              className={cn('pb-3 text-sm font-semibold uppercase tracking-wider transition-all', activeTab === 'parts' ? 'text-[var(--amber)] border-b-2 border-[var(--amber)]' : 'text-[var(--t4)] hover:text-[var(--t2)]')}
            >
              Parts ({PARTS_SOURCES.length})
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {sources.slice(0, 12).map((src) => (
              <div key={src.id} className="bg-[var(--s3)] border border-[var(--b1)] rounded-[var(--r2)] p-3 flex flex-col justify-between hover:border-[var(--b2)] transition-colors">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-[var(--t1)] truncate">{src.name}</span>
                    <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-[var(--r1)] bg-[var(--glo)] text-[var(--green)] border border-[var(--gbd)]">LIVE</span>
                  </div>
                  <p className="text-xs text-[var(--t3)] line-clamp-2">{src.notes || 'Aggregated inventory pool.'}</p>
                </div>
                <div className="mt-3 flex justify-between items-end text-[10px] text-[var(--t4)] uppercase tracking-wider">
                  <span>Every 5m</span>
                  <span className="text-[var(--t2)] font-[var(--fm)]">14,209</span>
                </div>
              </div>
            ))}
            {sources.length > 12 && (
              <div className="bg-[var(--s3)] border border-[var(--b1)] border-dashed rounded-[var(--r2)] p-3 flex items-center justify-center text-[var(--t3)] hover:text-[var(--t1)] cursor-pointer">
                + View All {sources.length} Sources
              </div>
            )}
          </div>
        </>
      )}

      {/* SCAN TERMINAL */}
      <div className="bg-[#050508] border border-[var(--b1)] rounded-[var(--r3)] p-4 h-[150px] overflow-y-auto font-[var(--fm)] text-xs relative shadow-inner" ref={terminalRef}>
        <div className="absolute top-2 right-3 text-[10px] text-[var(--t4)] uppercase tracking-widest flex items-center gap-2">
          {scanning && <span className="animate-pulse w-2 h-2 rounded-full bg-[var(--amber)] inline-block" />}
          Live Stream
        </div>
        <div className="space-y-1 mt-2">
          {logs.map((log, i) => {
            const isMatch = log.includes('[MATCH]')
            const isDone = log.includes('[DONE]')
            const isSys = log.includes('[SYS]')
            
            return (
              <div key={i} className={cn(
                'transition-all',
                isMatch ? 'text-[var(--amber)] font-bold' :
                isDone ? 'text-[var(--green)] font-bold' :
                isSys ? 'text-[#62627A]' :
                'text-[#9898A8]'
              )}>
                {log}
              </div>
            )
          })}
        </div>
      </div>

      {/* FILTER BAR & RESULTS */}
      {(results.length > 0 || scanning) && (
        <div className="animate-fadeUp">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--s2)] p-3 rounded-[var(--r2)] border border-[var(--b1)] mb-4">
            <div className="flex flex-wrap gap-2">
              <select className="bg-[var(--s3)] border border-[var(--b1)] rounded-[var(--r1)] px-2 py-1.5 text-xs text-[var(--t2)] outline-none focus:border-[var(--amber)]" value={minProfit} onChange={e=>setMinProfit(e.target.value)}>
                <option value="1k">Min Profit: $1k+</option>
                <option value="2k">Min Profit: $2k+</option>
                <option value="3k">Min Profit: $3k+</option>
                <option value="4k">Min Profit: $4k+</option>
              </select>
              <select className="bg-[var(--s3)] border border-[var(--b1)] rounded-[var(--r1)] px-2 py-1.5 text-xs text-[var(--t2)] outline-none focus:border-[var(--amber)]" value={titleType} onChange={e=>setTitleType(e.target.value)}>
                <option value="all">Title: All</option>
                <option value="clean">Title: Clean</option>
                <option value="rebuilt">Title: Rebuilt</option>
                <option value="salvage">Title: Salvage</option>
              </select>
              <select className="bg-[var(--s3)] border border-[var(--b1)] rounded-[var(--r1)] px-2 py-1.5 text-xs text-[var(--t2)] outline-none focus:border-[var(--amber)]" value={damage} onChange={e=>setDamage(e.target.value)}>
                <option value="any">Damage: Any</option>
                <option value="minor">Damage: Minor</option>
                <option value="mod">Damage: Moderate</option>
                <option value="sev">Damage: Severe</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--t3)]">Showing near:</span>
              <select className="bg-[var(--s3)] border border-[var(--b1)] rounded-[var(--r1)] px-2 py-1.5 text-xs font-bold text-[var(--t1)] outline-none focus:border-[var(--amber)]" value={state} onChange={e=>setState(e.target.value)}>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {results.map((car) => (
              <Panel key={car.id} className="p-4 flex flex-col md:flex-row gap-4 justify-between group hover:border-[var(--amber-bd)]">
                {/* Left: Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-[var(--r1)] bg-[var(--s4)] text-[var(--t2)] border border-[var(--b1)]">{car.source}</span>
                    <span className="text-[10px] uppercase font-bold text-[var(--t3)]">{car.type}</span>
                    <div className="ml-auto md:hidden text-lg font-black text-[var(--amber)]">{car.score}</div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-[var(--t1)] mb-1">{car.year} {car.make} {car.model}</h3>
                  <p className="text-sm text-[var(--t3)] mb-3">{car.dealer} · {car.city}, {car.state} · <Mono>{car.miles.toLocaleString()} mi</Mono></p>
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Tag color="green">Est. profit +<Mono>${car.profit.toLocaleString()}</Mono></Tag>
                    <span className="text-[var(--t2)]"><Mono>${car.ask.toLocaleString()}</Mono> ask</span>
                    <span className="text-[var(--t4)]">MMR <Mono>${car.mmr.toLocaleString()}</Mono></span>
                  </div>
                </div>

                {/* Right: Score & Actions */}
                <div className="flex flex-col justify-between items-end gap-4 border-t border-[var(--b1)] md:border-t-0 md:border-l pl-0 md:pl-4 pt-4 md:pt-0 shrink-0">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--t4)]">Score</span>
                    <span className={cn('text-3xl font-black', car.score > 80 ? 'text-[var(--green)]' : car.score > 60 ? 'text-[var(--amber)]' : 'text-[var(--red)]')}>{car.score}</span>
                  </div>
                  
                  <div className="flex flex-wrap md:flex-col gap-2 w-full md:w-auto mt-auto">
                    <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider text-[var(--t3)] mb-2 md:mb-1 w-full justify-between md:justify-end">
                      <span>[REPAIR: ~<Mono>${car.repair}</Mono>]</span>
                      <span>[{car.title}]</span>
                      <span>[{car.ends}]</span>
                    </div>
                    <div className="flex gap-2 w-full justify-end">
                      <Btn className="bg-[var(--s3)] text-[var(--t2)] hover:bg-[var(--s4)] border border-[var(--b1)]">Watch</Btn>
                      <a href={`/deal/${car.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all px-4 bg-[var(--amber-lo)] text-[var(--amber)] border border-[var(--amber-bd)] hover:bg-[var(--amber)] hover:text-[var(--s0)]">
                        Analyze &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
