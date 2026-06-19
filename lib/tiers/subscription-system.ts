// Tier-based subscription system for DealerHunt

export interface SubscriptionTier {
  id: string
  name: string
  price: number
  billing: 'monthly' | 'yearly'
  features: string[]
  limits: {
    vehiclesPerMonth: number
    searchesPerDay: number
    arbitrageReports: number
    tearDownAnalyses: number
    dealerContacts: number
    apiCalls: number
    dataExport: boolean
    realTimeAlerts: boolean
    prioritySupport: boolean
    customIntegrations: boolean
    whiteLabel: boolean
  }
  targetMarket: string
  description: string
  popular?: boolean
  discount?: number
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    billing: 'monthly',
    features: [
      'Basic vehicle search',
      '5 searches per day',
      'Email alerts',
      'Mobile app access',
      'Basic dealer directory'
    ],
    limits: {
      vehiclesPerMonth: 50,
      searchesPerDay: 5,
      arbitrageReports: 5,
      tearDownAnalyses: 3,
      dealerContacts: 10,
      apiCalls: 100,
      dataExport: false,
      realTimeAlerts: false,
      prioritySupport: false,
      customIntegrations: false,
      whiteLabel: false
    },
    targetMarket: 'Individual dealers, small operations',
    description: 'Perfect for getting started with vehicle sourcing intelligence'
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    billing: 'monthly',
    features: [
      'Unlimited vehicle search',
      'Geographic arbitrage analysis',
      'Parts tear-down calculator',
      'Advanced filtering',
      'Real-time price alerts',
      'Priority support',
      'Data export (CSV)'
    ],
    limits: {
      vehiclesPerMonth: 500,
      searchesPerDay: 50,
      arbitrageReports: 50,
      tearDownAnalyses: 25,
      dealerContacts: 100,
      apiCalls: 1000,
      dataExport: true,
      realTimeAlerts: true,
      prioritySupport: true,
      customIntegrations: false,
      whiteLabel: false
    },
    targetMarket: 'Growing dealerships, medium operations',
    description: 'Complete vehicle sourcing toolkit for serious dealers',
    popular: true
  },
  {
    id: 'business',
    name: 'Business',
    price: 349,
    billing: 'monthly',
    features: [
      'Everything in Professional',
      'Multi-user accounts (5 users)',
      'API access',
      'Custom integrations',
      'Advanced analytics',
      'White-label reports',
      'Dedicated account manager',
      'Phone support'
    ],
    limits: {
      vehiclesPerMonth: 2000,
      searchesPerDay: 200,
      arbitrageReports: 200,
      tearDownAnalyses: 100,
      dealerContacts: 500,
      apiCalls: 10000,
      dataExport: true,
      realTimeAlerts: true,
      prioritySupport: true,
      customIntegrations: true,
      whiteLabel: false
    },
    targetMarket: 'Established dealerships, large operations',
    description: 'Enterprise-grade solution for high-volume dealers'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 999,
    billing: 'monthly',
    features: [
      'Everything in Business',
      'Unlimited users',
      'Unlimited API calls',
      'Custom white-label platform',
      'On-premise deployment option',
      'Custom feature development',
      '24/7 dedicated support',
      'SLA guarantee'
    ],
    limits: {
      vehiclesPerMonth: 999999,
      searchesPerDay: 999999,
      arbitrageReports: 999999,
      tearDownAnalyses: 999999,
      dealerContacts: 999999,
      apiCalls: 999999,
      dataExport: true,
      realTimeAlerts: true,
      prioritySupport: true,
      customIntegrations: true,
      whiteLabel: true
    },
    targetMarket: 'Large dealer groups, automotive corporations',
    description: 'Fully customized solution for enterprise operations'
  }
]

// Annual pricing (2 months free)
export const ANNUAL_DISCOUNT = 0.83 // 17% discount (2 months free)

export interface UserSubscription {
  userId: string
  tierId: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  stripeSubscriptionId?: string
  stripeCustomerId?: string
  usage: {
    vehiclesThisMonth: number
    searchesToday: number
    arbitrageReportsThisMonth: number
    tearDownAnalysesThisMonth: number
    dealerContactsThisMonth: number
    apiCallsThisMonth: number
  }
  metadata: Record<string, any>
}

export interface UsageLimit {
  current: number
  limit: number
  percentage: number
  isExceeded: boolean
  resetsAt: Date
}

export class SubscriptionManager {
  
  // Get tier by ID
  getTier(tierId: string): SubscriptionTier | null {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId) || null
  }
  
  // Get all tiers
  getAllTiers(): SubscriptionTier[] {
    return SUBSCRIPTION_TIERS
  }
  
  // Calculate annual price
  getAnnualPrice(tierId: string): number {
    const tier = this.getTier(tierId)
    if (!tier) return 0
    return Math.round(tier.price * 12 * ANNUAL_DISCOUNT)
  }
  
  // Check if user can perform action
  async checkUsageLimit(
    subscription: UserSubscription,
    action: 'search' | 'arbitrage' | 'teardown' | 'contact' | 'api' | 'export'
  ): Promise<UsageLimit> {
    const tier = this.getTier(subscription.tierId)
    if (!tier) {
      throw new Error('Invalid subscription tier')
    }
    
    let current = 0
    let limit = 0
    let resetsAt = new Date()
    
    switch (action) {
      case 'search':
        current = subscription.usage.searchesToday
        limit = tier.limits.searchesPerDay
        resetsAt = new Date()
        resetsAt.setHours(23, 59, 59, 999) // End of day
        break
      case 'arbitrage':
        current = subscription.usage.arbitrageReportsThisMonth
        limit = tier.limits.arbitrageReports
        resetsAt = new Date(subscription.currentPeriodEnd)
        break
      case 'teardown':
        current = subscription.usage.tearDownAnalysesThisMonth
        limit = tier.limits.tearDownAnalyses
        resetsAt = new Date(subscription.currentPeriodEnd)
        break
      case 'contact':
        current = subscription.usage.dealerContactsThisMonth
        limit = tier.limits.dealerContacts
        resetsAt = new Date(subscription.currentPeriodEnd)
        break
      case 'api':
        current = subscription.usage.apiCallsThisMonth
        limit = tier.limits.apiCalls
        resetsAt = new Date(subscription.currentPeriodEnd)
        break
      case 'export':
        current = 1 // Binary check
        limit = tier.limits.dataExport ? 1 : 0
        resetsAt = new Date(subscription.currentPeriodEnd)
        break
    }
    
    const percentage = limit > 0 ? (current / limit) * 100 : 0
    const isExceeded = current >= limit
    
    return {
      current,
      limit,
      percentage: Math.round(percentage),
      isExceeded,
      resetsAt
    }
  }
  
  // Increment usage
  async incrementUsage(
    subscription: UserSubscription,
    action: 'search' | 'arbitrage' | 'teardown' | 'contact' | 'api'
  ): Promise<void> {
    // This would update the database
    // For now, we'll simulate the increment
    switch (action) {
      case 'search':
        subscription.usage.searchesToday++
        break
      case 'arbitrage':
        subscription.usage.arbitrageReportsThisMonth++
        break
      case 'teardown':
        subscription.usage.tearDownAnalysesThisMonth++
        break
      case 'contact':
        subscription.usage.dealerContactsThisMonth++
        break
      case 'api':
        subscription.usage.apiCallsThisMonth++
        break
    }
  }
  
  // Get feature access for tier
  getFeatureAccess(tierId: string): {
    canSearch: boolean
    canUseArbitrage: boolean
    canUseTearDown: boolean
    canExportData: boolean
    hasRealTimeAlerts: boolean
    hasPrioritySupport: boolean
    hasApiAccess: boolean
    hasCustomIntegrations: boolean
    hasWhiteLabel: boolean
  } {
    const tier = this.getTier(tierId)
    if (!tier) {
      return {
        canSearch: false,
        canUseArbitrage: false,
        canUseTearDown: false,
        canExportData: false,
        hasRealTimeAlerts: false,
        hasPrioritySupport: false,
        hasApiAccess: false,
        hasCustomIntegrations: false,
        hasWhiteLabel: false
      }
    }
    
    return {
      canSearch: tier.limits.searchesPerDay > 0,
      canUseArbitrage: tier.limits.arbitrageReports > 0,
      canUseTearDown: tier.limits.tearDownAnalyses > 0,
      canExportData: tier.limits.dataExport,
      hasRealTimeAlerts: tier.limits.realTimeAlerts,
      hasPrioritySupport: tier.limits.prioritySupport,
      hasApiAccess: tier.limits.apiCalls > 1000, // More than 1000 calls indicates API access
      hasCustomIntegrations: tier.limits.customIntegrations,
      hasWhiteLabel: tier.limits.whiteLabel
    }
  }
  
  // Calculate upgrade recommendation
  getUpgradeRecommendation(currentTierId: string, usage: UserSubscription['usage']): {
    recommendedTier: SubscriptionTier | null
    reason: string
    urgency: 'low' | 'medium' | 'high'
  } {
    const currentTier = this.getTier(currentTierId)
    if (!currentTier) {
      return {
        recommendedTier: null,
        reason: 'Invalid current tier',
        urgency: 'high'
      }
    }
    
    // Check if user is hitting limits
    const searchUsage = (usage.searchesToday / currentTier.limits.searchesPerDay) * 100
    const arbitrageUsage = (usage.arbitrageReportsThisMonth / currentTier.limits.arbitrageReports) * 100
    const tearDownUsage = (usage.tearDownAnalysesThisMonth / currentTier.limits.tearDownAnalyses) * 100
    
    let recommendedTier: SubscriptionTier | null = null
    let reason = ''
    let urgency: 'low' | 'medium' | 'high' = 'low'
    
    // High urgency if hitting multiple limits
    if (searchUsage > 90 && arbitrageUsage > 90) {
      recommendedTier = this.getTier('professional')
      reason = 'You\'re hitting search and arbitrage limits frequently'
      urgency = 'high'
    } else if (searchUsage > 80) {
      recommendedTier = this.getTier('professional')
      reason = 'You\'re approaching daily search limits'
      urgency = 'medium'
    } else if (arbitrageUsage > 80) {
      recommendedTier = this.getTier('professional')
      reason = 'You\'re approaching arbitrage report limits'
      urgency = 'medium'
    } else if (tearDownUsage > 80) {
      recommendedTier = this.getTier('professional')
      reason = 'You\'re approaching tear-down analysis limits'
      urgency = 'medium'
    }
    
    // Check if Business tier would be better
    if (usage.apiCallsThisMonth > 500 && currentTier.id === 'professional') {
      recommendedTier = this.getTier('business')
      reason = 'High API usage suggests Business tier would be more cost-effective'
      urgency = 'medium'
    }
    
    return {
      recommendedTier,
      reason,
      urgency
    }
  }
  
  // Calculate subscription value metrics
  getValueMetrics(tierId: string, usage: UserSubscription['usage']): {
    averageCostPerSearch: number
    averageCostPerArbitrage: number
    averageCostPerTearDown: number
    utilizationRate: number
    valueScore: number
  } {
    const tier = this.getTier(tierId)
    if (!tier) {
      return {
        averageCostPerSearch: 0,
        averageCostPerArbitrage: 0,
        averageCostPerTearDown: 0,
        utilizationRate: 0,
        valueScore: 0
      }
    }
    
    const monthlyPrice = tier.price
    
    const avgCostPerSearch = usage.searchesToday > 0 ? monthlyPrice / usage.searchesToday : 0
    const avgCostPerArbitrage = usage.arbitrageReportsThisMonth > 0 ? monthlyPrice / usage.arbitrageReportsThisMonth : 0
    const avgCostPerTearDown = usage.tearDownAnalysesThisMonth > 0 ? monthlyPrice / usage.tearDownAnalysesThisMonth : 0
    
    // Calculate utilization rate based on all limits
    const totalPossibleUsage = tier.limits.searchesPerDay * 30 + // Daily searches * 30 days
                              tier.limits.arbitrageReports +
                              tier.limits.tearDownAnalyses +
                              tier.limits.dealerContacts
    
    const totalActualUsage = usage.searchesToday * 30 + // Extrapolate daily usage
                              usage.arbitrageReportsThisMonth +
                              usage.tearDownAnalysesThisMonth +
                              usage.dealerContactsThisMonth
    
    const utilizationRate = totalPossibleUsage > 0 ? (totalActualUsage / totalPossibleUsage) * 100 : 0
    
    // Value score based on utilization and cost efficiency
    const valueScore = (utilizationRate * 0.6) + // 60% weight on utilization
                       ((100 - Math.min(avgCostPerSearch, 100)) * 0.4) // 40% weight on cost efficiency
    
    return {
      averageCostPerSearch: Math.round(avgCostPerSearch * 100) / 100,
      averageCostPerArbitrage: Math.round(avgCostPerArbitrage * 100) / 100,
      averageCostPerTearDown: Math.round(avgCostPerTearDown * 100) / 100,
      utilizationRate: Math.round(utilizationRate),
      valueScore: Math.round(valueScore)
    }
  }
  
  // Generate subscription report
  async generateSubscriptionReport(subscription: UserSubscription): Promise<{
    tier: SubscriptionTier
    usage: UserSubscription['usage']
    limits: UsageLimit[]
    valueMetrics: any
    upgradeRecommendation: any
    status: string
  }> {
    const tier = this.getTier(subscription.tierId)!
    
    const limits = [
      await this.checkUsageLimit(subscription, 'search'),
      await this.checkUsageLimit(subscription, 'arbitrage'),
      await this.checkUsageLimit(subscription, 'teardown'),
      await this.checkUsageLimit(subscription, 'contact'),
      await this.checkUsageLimit(subscription, 'export')
    ]
    
    return {
      tier,
      usage: subscription.usage,
      limits,
      valueMetrics: this.getValueMetrics(subscription.tierId, subscription.usage),
      upgradeRecommendation: this.getUpgradeRecommendation(subscription.tierId, subscription.usage),
      status: subscription.status
    }
  }
}
