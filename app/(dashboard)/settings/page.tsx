'use client'

import { useState, useEffect } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Tag } from '@/components/shared/Tag'
import { Field } from '@/components/shared/Field'
import { Btn } from '@/components/shared/Btn'

const isConfigured = (envKey?: string) => {
  if (typeof envKey !== 'string') return false
  return envKey.length > 0 && !envKey.includes('mock')
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    city: '',
    state: '',
  })

  const INTEGRATIONS = [
    { name: 'Copart', status: isConfigured(process.env.NEXT_PUBLIC_COPART_USER) ? 'connected' : 'disconnected' },
    { name: 'IAAI', status: isConfigured(process.env.NEXT_PUBLIC_IAA_USER) ? 'connected' : 'disconnected' },
    { name: 'MarketCheck', status: isConfigured(process.env.NEXT_PUBLIC_MARKETCHECK_API_KEY) ? 'connected' : 'disconnected' },
    { name: 'Stripe Billing', status: isConfigured(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) ? 'connected' : 'disconnected' },
  ]

  useEffect(() => {
    setLoading(true)
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile({
            name: data.profile.full_name || '',
            phone: data.profile.phone || '',
            city: data.profile.city || '',
            state: data.profile.state || '',
          })
        } else if (data.error) {
          setError(data.error)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.name,
          phone: profile.phone,
          city: profile.city,
          state: profile.state,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Settings</h1>
        <p className="text-sm text-[#9898A8] mt-1">Dealer profile, billing, and integrations.</p>
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">Dealer Profile</h2>
        {loading && <p className="text-sm text-[#9898A8]">Loading profile...</p>}
        {error && <p className="text-sm text-[#EF4444] mb-3">{error}</p>}
        {!loading && (
        <>
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
        </>
        )}
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
