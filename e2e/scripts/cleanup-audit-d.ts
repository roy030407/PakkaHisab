/**
 * Delete every Supabase auth user whose email starts with "audit-d-" and the
 * store rows they own. Opt-in: prints what it would delete unless --yes.
 * Run: npx tsx scripts/cleanup-audit-d.ts [--yes]
 */
import { admin } from '../helpers/session'

async function main() {
  const yes = process.argv.includes('--yes')
  const sb = admin()
  const victims: { id: string; email: string }[] = []
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) if (u.email?.startsWith('audit-d-')) victims.push({ id: u.id, email: u.email })
    if (data.users.length < 200) break
  }
  console.log(`${victims.length} audit-d users`)
  if (!yes) { victims.slice(0, 20).forEach((v) => console.log('  would delete', v.email)); return }
  for (const v of victims) {
    // Stores are tenant roots; child tables reference store_id.
    await sb.from('stores').delete().eq('owner_id', v.id)
    const { error } = await sb.auth.admin.deleteUser(v.id)
    console.log(error ? `  FAILED ${v.email}: ${error.message}` : `  deleted ${v.email}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
