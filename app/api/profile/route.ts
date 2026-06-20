export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServerComponentClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, phone, city, state')
    .eq('id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}

export async function POST(req: NextRequest) {
  const supabase = createServerComponentClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()
  const { full_name, phone, city, state } = body

  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name,
      phone,
      city,
      state,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
