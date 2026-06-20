/**
 * FILE: app/api/transactions/last/route.ts
 *
 * WHAT THIS DOES:
 *   Returns the created_at date of the most recent transaction for this store.
 *   Used by the inventory page to show the upload schedule prompt.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Called by app/(dashboard)/inventory/page.tsx on mount.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ lastDate: null })

  const { data: tx } = await supabase
    .from('transactions')
    .select('created_at')
    .eq('store_id', store.id)
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ lastDate: tx?.created_at ?? null })
}
