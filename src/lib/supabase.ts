import { createClient } from '@supabase/supabase-js'

const directUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || ''

/**
 * Em produção o navegador fala com o Supabase pelo próprio domínio do app (/sb/...),
 * e a Vercel repassa para <projeto>.supabase.co (ver vercel.json). Algumas operadoras
 * bloqueiam *.supabase.co, o que gerava "Load failed"/"Failed to fetch" no login.
 * VITE_SUPABASE_DIRECT=true volta a acessar o Supabase direto.
 */
const useProxy = Boolean(directUrl) && import.meta.env.PROD && import.meta.env.VITE_SUPABASE_DIRECT !== 'true' &&
  typeof window !== 'undefined' && window.location.protocol === 'https:'
export const supabaseUrl = useProxy ? `${window.location.origin}/sb` : directUrl

// Mantém a mesma chave de sessão de antes do proxy, para ninguém ser deslogado.
const projectRef = (() => { try { return new URL(directUrl).hostname.split('.')[0] } catch { return 'app' } })()

export const isConfigured = Boolean(supabaseUrl && key)
export const supabase = isConfigured
  ? createClient(supabaseUrl, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: `sb-${projectRef}-auth-token` },
    })
  : null
