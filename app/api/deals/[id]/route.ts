import { NextRequest, NextResponse } from 'next/server'
import { DealsService } from '@/lib/data/deals-service'
import { isSupabaseConfigured } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  }

  try {
    const { id } = await params
    const dealsService = new DealsService()
    const deal = await dealsService.getDealById(id)
    
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error in single deal API:', error)
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 })
  }
}
