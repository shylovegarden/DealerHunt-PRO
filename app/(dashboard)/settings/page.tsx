'use client'

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
  return (
    <div className="space-y-4 max-w-3xl">
      <Panel>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">Settings</h1>
        <p className="text-sm text-[#9898A8] mt-1">Dealer profile, billing, and integrations.</p>
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold text-[#D1D1DC] uppercase tracking-wider mb-3">Dealer Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dealership Name" defaultValue="DealerHunt Motors" />
          <Field label="Phone" defaultValue="(555) 123-4567" />
          <Field label="City" defaultValue="Austin" />
          <Field label="State" defaultValue="TX" />
        </div>
        <div className="mt-4">
          <Btn className="w-full sm:w-auto">Save Profile</Btn>
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
