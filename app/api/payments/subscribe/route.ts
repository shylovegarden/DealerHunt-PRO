export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { StripePaymentSystem } from '@/lib/payments/stripe-system'
import { AuthSystem } from '@/lib/auth/auth-system'


export async function POST(request: NextRequest) {
  try {
    const authSystem = new AuthSystem()
    const stripeSystem = new StripePaymentSystem()
    const body = await request.json()
    const { tierId, billing = 'monthly', paymentMethodData } = body

    // Get current user from session
    const session = await authSystem.getCurrentSession()
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 })
    }

    // Validate tier
    const validTiers = ['starter', 'professional', 'business', 'enterprise']
    if (!validTiers.includes(tierId)) {
      return NextResponse.json({ 
        error: 'Invalid subscription tier' 
      }, { status: 400 })
    }

    // Create or get customer
    const customer = await stripeSystem.getOrCreateCustomer(
      session.user.id,
      session.user.email,
      session.user.name,
      session.user.phone
    )

    // Create payment intent
    const paymentIntent = await stripeSystem.createPaymentIntent(
      session.user.id,
      tierId,
      billing
    )

    // If payment method data provided, add it
    let paymentMethodId = ''
    if (paymentMethodData) {
      const validation = stripeSystem.validatePaymentMethod(paymentMethodData)
      if (!validation.isValid) {
        return NextResponse.json({ 
          error: 'Invalid payment method',
          details: validation.errors
        }, { status: 400 })
      }

      const paymentMethod = await stripeSystem.addPaymentMethod(
        customer.id,
        paymentMethodData
      )
      paymentMethodId = paymentMethod.id
    }

    return NextResponse.json({
      message: 'Payment intent created',
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      },
      customer: {
        id: customer.id
      }
    })

  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json({ 
      error: 'Failed to create subscription' 
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const stripeSystem = new StripePaymentSystem()
    const authSystem = new AuthSystem()
    const body = await request.json()
    const { subscriptionId, tierId, cancelAtPeriodEnd } = body

    // Get current user from session
    const session = await authSystem.getCurrentSession()
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 })
    }

    // Update subscription
    const updatedSubscription = await stripeSystem.updateSubscription(
      subscriptionId,
      {
        tierId,
        cancelAtPeriodEnd
      }
    )

    return NextResponse.json({
      message: 'Subscription updated successfully',
      subscription: updatedSubscription
    })

  } catch (error) {
    console.error('Update subscription error:', error)
    return NextResponse.json({ 
      error: 'Failed to update subscription' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const stripeSystem = new StripePaymentSystem()
    const authSystem = new AuthSystem()
    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('subscriptionId')
    const immediate = searchParams.get('immediate') === 'true'

    if (!subscriptionId) {
      return NextResponse.json({ 
        error: 'Subscription ID is required' 
      }, { status: 400 })
    }

    // Get current user from session
    const session = await authSystem.getCurrentSession()
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 })
    }

    // Cancel subscription
    const canceledSubscription = await stripeSystem.cancelSubscription(
      subscriptionId,
      immediate
    )

    return NextResponse.json({
      message: 'Subscription canceled successfully',
      subscription: canceledSubscription
    })

  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json({ 
      error: 'Failed to cancel subscription' 
    }, { status: 500 })
  }
}
