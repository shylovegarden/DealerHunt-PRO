export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { InventoryService } from '@/lib/data/inventory-service'
import { isSupabaseConfigured } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const dealerId = searchParams.get('dealerId')

    if (!dealerId) {
      return NextResponse.json({ error: 'dealerId required' }, { status: 400 })
    }

    const stage = searchParams.get('stage')?.split(',').filter(Boolean) as any
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined

    const inventoryService = new InventoryService()
    const result = await inventoryService.getInventory(dealerId, { stage, limit, offset })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in inventory API:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { id, stage } = body

    if (!id || !stage) {
      return NextResponse.json({ error: 'id and stage required' }, { status: 400 })
    }

    const inventoryService = new InventoryService()
    const item = await inventoryService.updateStage(id, stage)

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating inventory:', error)
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 })
  }
}
