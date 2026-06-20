'use client'

import { useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Btn } from '@/components/shared/Btn'
import { Tag } from '@/components/shared/Tag'
import { Ico } from '@/components/shared/Ico'

const PLATFORMS = [
  { id: 'fb', name: 'Facebook Marketplace', connected: true },
  { id: 'at', name: 'AutoTrader', connected: true },
  { id: 'cg', name: 'CarGurus', connected: false },
  { id: 'cars', name: 'Cars.com', connected: false },
  { id: 'cl', name: 'Craigslist', connected: true },
]

const INVENTORY = [
  { id: '1', year: 2021, make: 'Ford', model: 'F-150', price: 42500, selected: true },
  { id: '2', year: 2022, make: 'Tesla', model: 'Model 3', price: 34900, selected: false },
  { id: '3', year: 2019, make: 'Toyota', model: 'Tacoma', price: 31500, selected: true },
]

export default function ListPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['fb', 'at', 'cl'])
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>(['1', '3'])
  const [blasting, setBlasting] = useState(false)
  const [done, setDone] = useState(false)

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const toggleVehicle = (id: string) => {
    setSelectedVehicles((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  const handleBlast = () => {
    setBlasting(true)
    setDone(false)
    setTimeout(() => {
      setBlasting(false)
      setDone(true)
    }, 2000)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
          <Ico name="list" className="text-[#F59E0B]" /> List Everywhere
        </h1>
        <p className="text-sm text-[#9898A8] mt-1">Syndicate inventory to marketplaces in one blast.</p>
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">1. Select Vehicles</h2>
        <div className="space-y-2">
          {INVENTORY.map((vehicle) => (
            <button
              key={vehicle.id}
              onClick={() => toggleVehicle(vehicle.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                selectedVehicles.includes(vehicle.id)
                  ? 'border-[rgba(245,158,11,.22)] bg-[rgba(245,158,11,.10)]'
                  : 'border-[rgba(255,255,255,.06)] hover:border-[rgba(255,255,255,.10)]'
              }`}
            >
              <span className="text-sm text-[#FAFAFA]">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
              <span className="text-sm font-mono text-[#9898A8]">${vehicle.price.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">2. Select Platforms</h2>
        <div className="space-y-2">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              disabled={!platform.connected}
              onClick={() => togglePlatform(platform.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                selectedPlatforms.includes(platform.id)
                  ? 'border-[rgba(245,158,11,.22)] bg-[rgba(245,158,11,.10)]'
                  : 'border-[rgba(255,255,255,.06)] hover:border-[rgba(255,255,255,.10)]'
              }`}
            >
              <span className="text-sm text-[#FAFAFA]">{platform.name}</span>
              {platform.connected ? (
                <Tag color={selectedPlatforms.includes(platform.id) ? 'amber' : 'green'}>
                  {selectedPlatforms.includes(platform.id) ? 'Selected' : 'Connected'}
                </Tag>
              ) : (
                <Tag color="red">Disconnected</Tag>
              )}
            </button>
          ))}
        </div>
      </Panel>

      <Btn
        loading={blasting}
        disabled={selectedVehicles.length === 0 || selectedPlatforms.length === 0 || blasting}
        className="w-full"
        onClick={handleBlast}
      >
        {done ? 'Blast Complete' : 'Blast Listings'}
      </Btn>

      {done && (
        <Panel className="text-center py-6">
          <p className="text-[#10B981] font-semibold">Listings syndicated to {selectedPlatforms.length} platforms</p>
        </Panel>
      )}
    </div>
  )
}
