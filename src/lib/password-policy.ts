/** Client-side registration validation. Mirror the policy in Supabase Auth settings. Never trim or persist passwords. */
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

export function passwordChecks(password: string) {
  return [
    { id: 'length', label: 'Pelo menos 8 caracteres', valid: password.length >= MIN_PASSWORD_LENGTH },
    { id: 'letter', label: 'Uma letra', valid: /\p{L}/u.test(password) },
    { id: 'number', label: 'Um número', valid: /[0-9]/.test(password) },
    { id: 'symbol', label: 'Um símbolo, como ! @ # $', valid: /[^\p{L}\p{N}\s]/u.test(password) },
  ]
}

export function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export type Registration = { email: string; password: string; confirmPassword: string }
export type ValidationResult =
  | { ok: true; value: Registration }
  | { ok: false; code: string; message: string }

export function validateRegistration(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'invalid_input', message: 'Confira os dados do cadastro.' }
  }
  const input = body as Record<string, unknown>
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const confirmPassword = typeof input.confirmPassword === 'string' ? input.confirmPassword : ''
  if (!validEmail(email)) return { ok: false, code: 'invalid_email', message: 'Informe um e-mail válido.' }
  if (password.length > MAX_PASSWORD_LENGTH || !passwordChecks(password).every(rule => rule.valid)) {
    return { ok: false, code: 'weak_password', message: 'Use uma senha de 8 a 128 caracteres, com letras, números e símbolos.' }
  }
  if (password !== confirmPassword) {
    return { ok: false, code: 'password_mismatch', message: 'As senhas não coincidem. Digite a mesma senha nos dois campos.' }
  }
  return { ok: true, value: { email, password, confirmPassword } }
}
