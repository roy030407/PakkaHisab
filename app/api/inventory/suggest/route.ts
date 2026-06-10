/**
 * FILE: app/api/inventory/suggest/route.ts
 *
 * WHAT THIS DOES:
 *   GET — returns three suggestion buckets: orderToday, reduceOrdering, watchExpiry.
 *   Used by the OrderSuggestionCard on the inventory page.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Thin wrapper around lib/inventory/suggestions.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/inventory/OrderSuggestionCard.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generateOrderingSuggestions } from '@/lib/inventory/suggestions'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  try {
    const suggestions = await generateOrderingSuggestions(supabase, store.id)
    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
