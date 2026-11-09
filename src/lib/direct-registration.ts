import { supabase } from './supabase'
import { validateRegistration } from './password-policy'

type RequestInput =
  | { action: 'signup'; email: string; password: string; confirmPassword: string }
  | { action: 'finish-pending'; email: string; password: string }

/** Establishes a native user session. No administrative credentials exist in this client. */
export async function enterWithRegistration(input: RequestInput): Promise<void> {
  if (input.action === 'signup') {
    const validation = validateRegistration(input)
    if (!validation.ok) throw new Error(validation.message)
  }
  if (!supabase) throw new Error('Conexão indisponível. Tente novamente em instantes.')
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!baseUrl || !publishableKey) throw new Error('Cadastro indisponível neste ambiente.')

  let response: Response
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/register-account`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, email: input.email.trim().toLowerCase() }),
      signal: AbortSignal.timeout(45000),
      cache: 'no-store',
    })
  } catch {
    throw new Error('Não foi possível concluir o acesso. Confira sua conexão e tente novamente com a mesma senha.')
  }
  const result: unknown = await response.json().catch(() => null)
  const payload = result && typeof result === 'object' ? result as Record<string, unknown> : null
  if (!response.ok) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : 'Não foi possível concluir o acesso. Tente novamente.')
  }
  const session = payload?.session as Record<string, unknown> | undefined
  if (!session || typeof session.access_token !== 'string' || !session.access_token ||
      typeof session.refresh_token !== 'string' || !session.refresh_token) {
    throw new Error('A sessão não foi iniciada. Tente novamente com a mesma senha.')
  }
  // setSession verifies the user, persists the native session and emits SIGNED_IN.
  // App.tsx then goes directly to onboarding or the dashboard without another login.
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw new Error('Não foi possível iniciar a sessão. Tente novamente com a mesma senha.')
  if (!data.session || !data.user) throw new Error('Não foi possível iniciar a sessão. Tente novamente.')
}
