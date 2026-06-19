'use client'

import React, { useState } from 'react'
import { 
  ResponsiveContainer, 
  AdaptiveGrid, 
  SmartCard, 
  SmartModal, 
  SmartNav,
  useResponsive 
} from '@/components/ui/responsive-design-system'
import { SUBSCRIPTION_TIERS, ANNUAL_DISCOUNT } from '@/lib/tiers/subscription-system'

export default function PricingPage() {
  const { isMobile, isTablet, isDesktop } = useResponsive()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const handleSubscribe = (tierId: string) => {
    setSelectedTier(tierId)
    setShowPaymentModal(true)
  }

  const calculateAnnualPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12 * ANNUAL_DISCOUNT)
  }

  const calculateSavings = (monthlyPrice: number) => {
    const annualPrice = monthlyPrice * 12
    const discountedPrice = calculateAnnualPrice(monthlyPrice)
    return annualPrice - discountedPrice
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">DH</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">DealerHunt Pricing</h1>
            </div>
            <button
              onClick={() => window.location.href = '/dealerhunt'}
              className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Back to App
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Start free, upgrade as you grow. No hidden fees.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                billing === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                billing === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual
              <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <AdaptiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
          {SUBSCRIPTION_TIERS.map((tier) => {
            const price = billing === 'yearly' ? calculateAnnualPrice(tier.price) : tier.price
            const savings = billing === 'yearly' ? calculateSavings(tier.price) : 0
            const isPopular = tier.popular

            return (
              <SmartCard
                key={tier.id}
                variant={isPopular ? 'elevated' : 'outlined'}
                className={`relative ${isPopular ? 'ring-2 ring-blue-500' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-gray-900">${price}</span>
                      <span className="text-gray-600">/{billing === 'yearly' ? 'year' : 'month'}</span>
                    </div>
                    {savings > 0 && (
                      <div className="text-sm text-green-600 font-medium">
                        Save ${savings.toLocaleString()} per year
                      </div>
                    )}
                    <p className="text-gray-600 text-sm mt-2">{tier.description}</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {tier.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {tier.id === 'starter' ? 'Start Free Trial' : 'Subscribe Now'}
                  </button>

                  <div className="mt-4 text-xs text-gray-500 text-center">
                    {tier.targetMarket}
                  </div>
                </div>
              </SmartCard>
            )
          })}
        </AdaptiveGrid>

        {/* Feature Comparison */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Compare Features
          </h3>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-4 font-medium text-gray-900">Feature</th>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <th key={tier.id} className="text-center p-4 font-medium text-gray-900">
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="p-4 text-gray-700">Vehicle Searches</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center text-gray-900">
                        {tier.limits.searchesPerDay}/day
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-4 text-gray-700">Arbitrage Reports</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center text-gray-900">
                        {tier.limits.arbitrageReports}/month
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-700">Tear-Down Analyses</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center text-gray-900">
                        {tier.limits.tearDownAnalyses}/month
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-4 text-gray-700">Dealer Contacts</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center text-gray-900">
                        {tier.limits.dealerContacts}/month
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-700">API Access</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center">
                        {tier.limits.apiCalls > 1000 ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">−</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-4 text-gray-700">Data Export</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center">
                        {tier.limits.dataExport ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">−</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-700">Real-Time Alerts</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center">
                        {tier.limits.realTimeAlerts ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">−</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-4 text-gray-700">Priority Support</td>
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4 text-center">
                        {tier.limits.prioritySupport ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">−</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h3>
          
          <AdaptiveGrid cols={{ mobile: 1, tablet: 2 }}>
            <SmartCard variant="outlined">
              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Can I change plans anytime?
                </h4>
                <p className="text-gray-600 text-sm">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any differences.
                </p>
              </div>
            </SmartCard>
            
            <SmartCard variant="outlined">
              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Is there a free trial?
                </h4>
                <p className="text-gray-600 text-sm">
                  Yes! All new users get a 14-day free trial of the Professional plan to explore all features.
                </p>
              </div>
            </SmartCard>
            
            <SmartCard variant="outlined">
              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-2">
                  What payment methods do you accept?
                </h4>
                <p className="text-gray-600 text-sm">
                  We accept all major credit cards, debit cards, and ACH bank transfers for Enterprise plans.
                </p>
              </div>
            </SmartCard>
            
            <SmartCard variant="outlined">
              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Can I cancel anytime?
                </h4>
                <p className="text-gray-600 text-sm">
                  Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
                </p>
              </div>
            </SmartCard>
          </AdaptiveGrid>
        </div>
      </main>

      {/* Payment Modal */}
      <SmartModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        size={isMobile ? 'full' : 'md'}
        position="center"
      >
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Complete Your Subscription
          </h3>
          
          {selectedTier && (
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {SUBSCRIPTION_TIERS.find(t => t.id === selectedTier)?.name} Plan
                    </p>
                    <p className="text-sm text-gray-600">
                      {billing === 'yearly' ? 'Annual billing' : 'Monthly billing'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      ${billing === 'yearly' 
                        ? calculateAnnualPrice(SUBSCRIPTION_TIERS.find(t => t.id === selectedTier)!.price)
                        : SUBSCRIPTION_TIERS.find(t => t.id === selectedTier)!.price
                      }
                    </p>
                    <p className="text-sm text-gray-600">
                      /{billing === 'yearly' ? 'year' : 'month'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Number
              </label>
              <input
                type="text"
                placeholder="4242 4242 4242 4242"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration
                </label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CVC
                </label>
                <input
                  type="text"
                  placeholder="123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name on Card
              </label>
              <input
                type="text"
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="mt-6 flex space-x-3">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Handle payment processing
                alert('Payment processing would be handled here')
                setShowPaymentModal(false)
              }}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Subscribe Now
            </button>
          </div>
        </div>
      </SmartModal>
    </div>
  )
}
