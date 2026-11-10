// VitraCar password registration. Uses native Supabase Auth sessions, never custom JWTs.
// API-key authentication is performed here because callers do not yet have a session.
// Email verification is intentionally not required for this application's registration flow.
const URL = Deno.env.get('SUPABASE_URL')!;
const ADMIN = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const origins = new Set(['https://vitracar.vercel.app','https://vitracar-henriquecastroeditor-5558s-projects.vercel.app','https://vitracar-git-main-henriquecastroeditor-5558s-projects.vercel.app']);
const keys = new Set<string>([ANON]);
try { for (const key of Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'))) if (typeof key === 'string') keys.add(key); } catch { /* legacy public key is still accepted */ }
// Public application key, NOT an administrative secret. Supports hosted runtimes without PUBLISHABLE_KEYS.
keys.add('sb_publishable_3Xce172eFXXm9Ojiz0s2Ww_TrAJa5f8');

function headers(origin: string | null): Record<string,string> {
  const h: Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if (origin && origins.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  h['Access-Control-Allow-Headers'] = 'apikey, authorization, content-type, x-client-info';
  h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  return h;
}
async function boundedJson(req: Request): Promise<Record<string,unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  let text = '', size = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new Error('invalid_body'); }
    text += decoder.decode(part.value, {stream:true});
  }
  const body = JSON.parse(text + decoder.decode());
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  return body;
}
async function call(path: string, body: unknown, admin = false, method = 'POST') {
  const key = admin ? ADMIN : ANON;
  const res = await fetch(URL + path, {method, headers:{apikey:key,Authorization:'Bearer ' + key,'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}, body:JSON.stringify(body), signal:AbortSignal.timeout(12000)});
  const data = await res.json().catch(() => ({}));
  return {ok:res.ok,status:res.status,data};
}
const codeOf = (r: {data:Record<string,unknown>}) => r.data?.code || r.data?.error_code;
async function fingerprint(email: string) {
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(ADMIN),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('vitracar-registration:' + email));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function hasSession(result: {ok:boolean;data:Record<string,unknown>}) {
  return result.ok && typeof result.data.access_token === 'string' && typeof result.data.refresh_token === 'string';
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const h = headers(origin);
  const reply = (status:number,body:unknown) => new Response(JSON.stringify(body),{status,headers:h});
  const invalid = () => reply(400,{code:'invalid_credentials',message:'E-mail ou senha incorretos. Confira os dados para entrar.'});
  if (origin && !origins.has(origin)) return reply(403,{message:'Origem não autorizada.'});
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:h});
  if (req.method !== 'POST') return reply(405,{message:'Método não permitido.'});
  if (!URL || !ADMIN || !ANON) return reply(503,{message:'Cadastro indisponível. Tente novamente em instantes.'});
  if (!keys.has(req.headers.get('apikey') || '')) return reply(401,{message:'Aplicação não autorizada.'});
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply(415,{message:'Formato inválido.'});
  let body:Record<string,unknown>;
  try { body = await boundedJson(req); } catch { return reply(400,{message:'Confira os dados do cadastro.'}); }
  const action = body.action;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!['signup','finish-pending'].includes(String(action)) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 128) return reply(400,{message:'Confira o e-mail e a senha.'});
  if (action === 'signup') {
    if (password.length < 8 || !/\p{L}/u.test(password) || !/[0-9]/.test(password) || !/[^\p{L}\p{N}\s]/u.test(password)) return reply(400,{code:'weak_password',message:'Use pelo menos 8 caracteres com letras, números e símbolos.'});
    if (body.confirmPassword !== password) return reply(400,{code:'password_mismatch',message:'As senhas não coincidem.'});
  }
  try {
    const limit = await call('/rest/v1/rpc/vitracar_take_auth_attempt',{p_fingerprint:await fingerprint(email)},true);
    if (!limit.ok) return reply(503,{message:'Cadastro indisponível. Tente novamente em instantes.'});
    if (limit.data !== true) { h['Retry-After']='900'; return reply(429,{message:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'}); }
    // Registration must not log into, confirm, overwrite or reset an existing account.
    // Native Admin create is atomic and returns email_exists for a duplicate.
    if (action === 'signup') {
      const created = await call('/auth/v1/admin/users',{email,password,email_confirm:true},true);
      if (!created.ok) {
        if (['email_exists','email_already_registered','user_already_exists'].includes(String(codeOf(created)))) {
          return reply(409,{code:'email_exists',message:'Este e-mail já está cadastrado. Faça login para acessar sua conta.'});
        }
        if (created.status === 429) return reply(429,{message:'Muitas tentativas. Aguarde alguns minutos.'});
        if (codeOf(created) === 'weak_password') return reply(400,{code:'weak_password',message:'A senha não atende aos requisitos de segurança.'});
        return reply(created.status >= 500 ? 503 : 400,{code:'signup_failed',message:'Não foi possível criar a conta. Confira os dados e tente novamente.'});
      }
      const session = await call('/auth/v1/token?grant_type=password',{email,password});
      if (!hasSession(session)) return reply(503,{code:'session_unavailable',message:'Sua conta foi criada, mas não foi possível iniciar a sessão. Use Fazer login com a senha cadastrada.'});
      return reply(200,{session:{access_token:session.data.access_token,refresh_token:session.data.refresh_token}});
    }

    // This branch is only used to finish a pending LOGIN, never to re-register.
    let session = await call('/auth/v1/token?grant_type=password',{email,password});
    if (session.status === 429) return reply(429,{message:'Muitas tentativas. Aguarde alguns minutos.'});
    if (session.status >= 500) return reply(503,{message:'Serviço de acesso indisponível. Tente novamente em instantes.'});
    if (!hasSession(session) && codeOf(session) === 'email_not_confirmed') {
      // Supabase Auth checks the password before returning email_not_confirmed.
      // Incorrect passwords NEVER reach the administrative confirmation.
      const lookup = await call('/rest/v1/rpc/vitracar_pending_user_id',{p_email:email},true);
      if (!lookup.ok || typeof lookup.data !== 'string' || !/^[0-9a-f-]{36}$/i.test(lookup.data)) return invalid();
      const activate = await call('/auth/v1/admin/users/' + lookup.data,{email_confirm:true},true,'PUT');
      if (!activate.ok) return reply(503,{message:'Não foi possível liberar o acesso. Tente novamente.'});
      session = await call('/auth/v1/token?grant_type=password',{email,password});
    }
    if (!hasSession(session)) return invalid();
    // Only native USER tokens are returned. Administrative keys never leave this server.
    return reply(200,{session:{access_token:session.data.access_token,refresh_token:session.data.refresh_token}});
  } catch {
    // Never log request bodies, passwords, tokens or upstream responses.
    return reply(503,{message:'Não foi possível concluir o acesso agora. Tente novamente com a mesma senha.'});
  }
});
