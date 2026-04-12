import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[AralMate] Supabase env vars not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

// Sign in anonymously if no session exists
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    supabase.auth.signInAnonymously().catch(err => {
      console.warn('[AralMate] Anonymous sign-in failed:', err.message)
    })
  }
})

/**
 * Ping Supabase and return true if reachable.
 * Useful for debugging during Phase 3 development.
 */
export async function checkConnection() {
  try {
    const { error } = await supabase.from('students').select('id').limit(1)
    // RLS will block the read but a non-network error means we're connected
    return !error || error.code !== 'PGRST301'
  } catch {
    return false
  }
}
