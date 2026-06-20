'use client'

import { useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Tag } from '@/components/shared/Tag'
import { Field } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'

const INTEGRATIONS = [
  { name: 'Copart', status: 'connected' },
  { name: 'IAAI', status: 'connected' },
  { name: 'MarketCheck', status: 'disconnected' },
  { name: 'Stripe Billing', status: 'connected' },
]

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    city: '',
    state: '',
  })

  const handleSave = () => {
    setSaving(true)
    setSaved(false)
    // TODO: POST to /api/profile when auth is wired
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
    }, 800)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Settings</h1>
        <p className="text-sm text-[#9898A8] mt-1">Dealer profile, billing, and integrations.</p>
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">Dealer Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Dealership Name"
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            placeholder="Your dealership name"
          />
          <Field
            label="Phone"
            value={profile.phone}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            placeholder="(555) 123-4567"
          />
          <Field
            label="City"
            value={profile.city}
            onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
            placeholder="Austin"
          />
          <Field
            label="State"
            value={profile.state}
            onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
            placeholder="TX"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Btn loading={saving} onClick={handleSave} className="w-full sm:w-auto">Save Profile</Btn>
          {saved && <span className="text-sm text-[#10B981]">Saved</span>}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">Integrations</h2>
        <div className="space-y-2">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-between p-3 rounded-xl border border-[rgba(255,255,255,.06)]"
            >
              <span className="text-sm text-[#FAFAFA]">{integration.name}</span>
              <Tag color={integration.status === 'connected' ? 'green' : 'red'}>
                {integration.status === 'connected' ? 'Connected' : 'Disconnected'}
              </Tag>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
