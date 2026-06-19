// Stripe payment processing system for DealerHunt

import { SUBSCRIPTION_TIERS, ANNUAL_DISCOUNT, UserSubscription } from '../tiers/subscription-system'

export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'
  clientSecret: string
  metadata: {
    userId: string
    tierId: string
    billing: 'monthly' | 'yearly'
  }
}

export interface Customer {
  id: string
  email: string
  name: string
  phone?: string
  paymentMethods: PaymentMethod[]
  defaultPaymentMethod?: string
  subscriptions: UserSubscription[]
}

export interface PaymentMethod {
  id: string
  type: 'card' | 'bank_account'
  brand?: string
  last4: string
  expiry?: string
  isDefault: boolean
  createdAt: Date
}

export interface BillingPortal {
  url: string
  customerId: string
}

// Mock Stripe implementation (replace with actual Stripe SDK in production)
export class StripePaymentSystem {
  
  // Create payment intent for subscription upgrade
  async createPaymentIntent(
    userId: string,
    tierId: string,
    billing: 'monthly' | 'yearly' = 'monthly'
  ): Promise<PaymentIntent> {
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId)
    if (!tier) {
      throw new Error('Invalid tier ID')
    }
    
    const amount = billing === 'yearly' 
      ? Math.round(tier.price * 12 * ANNUAL_DISCOUNT * 100) // Convert to cents
      : tier.price * 100
    
    // Mock Stripe payment intent creation
    const paymentIntent: PaymentIntent = {
      id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      currency: 'usd',
      status: 'pending',
      clientSecret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        userId,
        tierId,
        billing
      }
    }
    
    return paymentIntent
  }
  
  // Create or get customer
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name: string,
    phone?: string
  ): Promise<Customer> {
    // Mock customer creation/retrieval
    const customer: Customer = {
      id: `cus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      phone,
      paymentMethods: [],
      subscriptions: []
    }
    
    return customer
  }
  
  // Add payment method
  async addPaymentMethod(
    customerId: string,
    paymentMethodData: {
      type: 'card'
      number: string
      expMonth: number
      expYear: number
      cvc: string
      name: string
    }
  ): Promise<PaymentMethod> {
    // Mock payment method creation
    const paymentMethod: PaymentMethod = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'card',
      brand: this.getCardBrand(paymentMethodData.number),
      last4: paymentMethodData.number.slice(-4),
      expiry: `${paymentMethodData.expMonth.toString().padStart(2, '0')}/${paymentMethodData.expYear.toString().slice(-2)}`,
      isDefault: false,
      createdAt: new Date()
    }
    
    return paymentMethod
  }
  
  // Create subscription
  async createSubscription(
    customerId: string,
    tierId: string,
    paymentMethodId: string,
    billing: 'monthly' | 'yearly' = 'monthly'
  ): Promise<UserSubscription> {
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId)
    if (!tier) {
      throw new Error('Invalid tier ID')
    }
    
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + (billing === 'yearly' ? 12 : 1))
    
    const subscription: UserSubscription = {
      userId: customerId, // In real implementation, this would be the actual user ID
      tierId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stripeCustomerId: customerId,
      usage: {
        vehiclesThisMonth: 0,
        searchesToday: 0,
        arbitrageReportsThisMonth: 0,
        tearDownAnalysesThisMonth: 0,
        dealerContactsThisMonth: 0,
        apiCallsThisMonth: 0
      },
      metadata: {
        billing,
        createdAt: now.toISOString()
      }
    }
    
    return subscription
  }
  
  // Update subscription
  async updateSubscription(
    subscriptionId: string,
    updates: {
      tierId?: string
      paymentMethodId?: string
      cancelAtPeriodEnd?: boolean
    }
  ): Promise<UserSubscription> {
    // Mock subscription update
    // In real implementation, this would call Stripe API
    const subscription: UserSubscription = {
      userId: 'mock_user_id',
      tierId: updates.tierId || 'professional',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: updates.cancelAtPeriodEnd || false,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: 'mock_customer_id',
      usage: {
        vehiclesThisMonth: 0,
        searchesToday: 0,
        arbitrageReportsThisMonth: 0,
        tearDownAnalysesThisMonth: 0,
        dealerContactsThisMonth: 0,
        apiCallsThisMonth: 0
      },
      metadata: {}
    }
    
    return subscription
  }
  
  // Cancel subscription
  async cancelSubscription(subscriptionId: string, immediate: boolean = false): Promise<UserSubscription> {
    // Mock subscription cancellation
    const subscription: UserSubscription = {
      userId: 'mock_user_id',
      tierId: 'professional',
      status: immediate ? 'canceled' : 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: !immediate,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: 'mock_customer_id',
      usage: {
        vehiclesThisMonth: 0,
        searchesToday: 0,
        arbitrageReportsThisMonth: 0,
        tearDownAnalysesThisMonth: 0,
        dealerContactsThisMonth: 0,
        apiCallsThisMonth: 0
      },
      metadata: {}
    }
    
    return subscription
  }
  
  // Create billing portal session
  async createBillingPortalSession(customerId: string): Promise<BillingPortal> {
    // Mock billing portal creation
    const billingPortal: BillingPortal = {
      url: `https://billing.stripe.com/session/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId
    }
    
    return billingPortal
  }
  
  // Process payment
  async processPayment(paymentIntentId: string): Promise<{
    success: boolean
    error?: string
  }> {
    // Mock payment processing
    // In real implementation, this would handle Stripe webhook events
    
    // Simulate 95% success rate
    const success = Math.random() > 0.05
    
    if (success) {
      return { success: true }
    } else {
      return { 
        success: false, 
        error: 'Payment failed. Please try again or use a different payment method.' 
      }
    }
  }
  
  // Get payment methods for customer
  async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    // Mock payment methods retrieval
    return []
  }
  
  // Set default payment method
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Mock setting default payment method
  }
  
  // Remove payment method
  async removePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Mock payment method removal
  }
  
  // Get customer subscriptions
  async getCustomerSubscriptions(customerId: string): Promise<UserSubscription[]> {
    // Mock subscriptions retrieval
    return []
  }
  
  // Calculate proration for mid-cycle changes
  async calculateProration(
    currentSubscription: UserSubscription,
    newTierId: string
  ): Promise<{
    proratedAmount: number
    creditAmount: number
    newAmount: number
  }> {
    const currentTier = SUBSCRIPTION_TIERS.find(t => t.id === currentSubscription.tierId)
    const newTier = SUBSCRIPTION_TIERS.find(t => t.id === newTierId)
    
    if (!currentTier || !newTier) {
      throw new Error('Invalid tier ID')
    }
    
    const daysRemaining = Math.ceil(
      (currentSubscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    
    const daysInPeriod = 30 // Assuming monthly billing
    const remainingRatio = daysRemaining / daysInPeriod
    
    const currentUnused = currentTier.price * remainingRatio
    const newProrated = newTier.price * remainingRatio
    
    const proratedAmount = Math.max(0, newProrated - currentUnused)
    const creditAmount = Math.max(0, currentUnused - newProrated)
    const newAmount = newTier.price
    
    return {
      proratedAmount: Math.round(proratedAmount * 100) / 100,
      creditAmount: Math.round(creditAmount * 100) / 100,
      newAmount
    }
  }
  
  // Validate payment method
  validatePaymentMethod(paymentMethodData: {
    number: string
    expMonth: number
    expYear: number
    cvc: string
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Card number validation
    if (!paymentMethodData.number || paymentMethodData.number.length < 13 || paymentMethodData.number.length > 19) {
      errors.push('Invalid card number')
    }
    
    // Expiration validation
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    if (paymentMethodData.expYear < currentYear || 
        (paymentMethodData.expYear === currentYear && paymentMethodData.expMonth < currentMonth)) {
      errors.push('Card has expired')
    }
    
    if (paymentMethodData.expMonth < 1 || paymentMethodData.expMonth > 12) {
      errors.push('Invalid expiration month')
    }
    
    // CVC validation
    if (!paymentMethodData.cvc || paymentMethodData.cvc.length < 3 || paymentMethodData.cvc.length > 4) {
      errors.push('Invalid CVC')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  // Get card brand from number
  private getCardBrand(cardNumber: string): string {
    const number = cardNumber.replace(/\D/g, '')
    
    if (number.startsWith('4')) return 'visa'
    if (number.startsWith('5') || number.startsWith('2')) return 'mastercard'
    if (number.startsWith('3')) return 'amex'
    if (number.startsWith('6')) return 'discover'
    
    return 'unknown'
  }
  
  // Format currency
  formatCurrency(amount: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100) // Convert from cents
  }
  
  // Get billing history
  async getBillingHistory(customerId: string): Promise<Array<{
    id: string
    date: Date
    amount: number
    currency: string
    status: 'succeeded' | 'failed' | 'pending'
    description: string
    invoiceUrl?: string
  }>> {
    // Mock billing history
    return []
  }
  
  // Get upcoming invoice
  async getUpcomingInvoice(subscriptionId: string): Promise<{
    amount: number
    currency: string
    date: Date
    description: string
  }> {
    // Mock upcoming invoice
    return {
      amount: 14900, // $149.00 in cents
      currency: 'usd',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      description: 'Professional Plan - Monthly'
    }
  }
}
