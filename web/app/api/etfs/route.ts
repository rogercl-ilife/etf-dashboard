import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim().toUpperCase()
  const limitParam = Number(searchParams.get('limit') || 100)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 100

  let query = supabase
    .from('etfs')
    .select('symbol,name,issuer,category,expense_ratio,inception_date')
    .order('symbol', { ascending: true })
    .limit(limit)

  if (q) {
    query = query.or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
