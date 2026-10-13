// No SDK persistence, cookies, analytics, PKCE exchange, or browser token storage.
export const AUTH_URL = 'https://gkxmmuuallqnghfksqpo.supabase.co/auth/v1';
export const PUBLIC_KEY = 'sb_publishable_QWf0FOCf96Zs8oWem7jVoA_9JMSBTcT';
export const PASSWORD_HELPER = 'Use at least 15 characters. Passphrases (including spaces) are welcome.';
export function parseProof(href, purpose) {
  const url = new URL(href);
  const path = purpose === 'recovery' ? '/password-reset' : '/email-confirmed';
  // New templates put proof in the fragment so the CDN request has no token.
  // Accept a single query proof for reviewed older token-hash links; never mix.
  if (url.search && url.hash) return null;
  const parameters = url.hash ? new URLSearchParams(url.hash.slice(1)) : url.searchParams;
  if (url.protocol !== 'https:' || url.hostname !== 'incrementumapp.com' || url.port ||
      ![path,`${path}.html`,`${path}/`].includes(url.pathname) ||
      parameters.getAll('token_hash').length !== 1 || parameters.getAll('type').length !== 1 ||
      [...parameters.keys()].some(key => !['token_hash','type'].includes(key)) ||
      parameters.get('type') !== purpose || !/^(?:pkce_)?(?:[0-9a-f]{56}|[0-9a-f]{64})$/i.test(parameters.get('token_hash') ?? '')) return null;
  return parameters.get('token_hash');
}
export function passwordError(password, confirmation) {
  if (Array.from(password).length < 15) return PASSWORD_HELPER;
  if (password.length > 128) return 'The password is too long.';
  if (password !== confirmation) return 'The two passwords do not match.';
  return null;
}
export function createAuthFlow({ href, purpose, fetchImpl = fetch, now = () => Date.now(), requestTimeout = 12000 }) {
  if (!['recovery','signup'].includes(purpose)) throw Error('Invalid verification purpose.');
  let proof = parseProof(href,purpose), session = null, generation = 0, busy = false;
  let phase = proof ? 'ready' : 'invalid';
  const controllers = new Set();
  const expired = () => !session || now() >= session.expiresAt;
  const current = g => { if (g !== generation) throw Error('This action was cancelled. Request a new email link.'); };
  const request = async (path, method, body, bearer) => {
    const controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(),requestTimeout);
    try {
      const response = await fetchImpl(`${AUTH_URL}${path}`, { method, mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',
        signal:controller.signal,headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json',...(bearer ? {Authorization:`Bearer ${bearer}`} : {})},
        ...(body ? {body:JSON.stringify(body)} : {}) });
      if (!response.ok) throw Error('This action could not be verified. The link may be expired or already used. Request a new email link from Incrementum.');
      return response.status === 204 ? null : await response.json();
    } finally { clearTimeout(timer); controllers.delete(controller); }
  };
  const revoke = bearer => { if (bearer) void request('/logout?scope=local','POST',null,bearer).catch(() => {}); };
  const validUser = user => user && /^[0-9a-f-]{36}$/i.test(user.id ?? '') && user.is_anonymous !== true && typeof user.email === 'string' && user.email.length <= 254 && Boolean(user.email_confirmed_at) && Number.isFinite(Date.parse(user.email_confirmed_at));
  return {
    get state() { return {phase,busy,email:session?.email ?? null}; },
    async verify() {
      if (busy || phase !== 'ready' || !proof) throw Error('Request a new email link from Incrementum.');
      busy = true; phase = 'verifying'; const g = ++generation, tokenHash = proof; proof = null;
      let bearer = null;
      try {
        const result = await request('/verify','POST',{token_hash:tokenHash,type:purpose});
        bearer = result?.access_token; current(g);
        if (typeof bearer !== 'string' || !bearer || bearer.length > 16000 || !validUser(result?.user) ||
            !Number.isFinite(result.expires_in) || result.expires_in < 1 || result.expires_in > 86400) throw Error('The email verification could not be confirmed. Request a new link.');
        const expiresAt = Number.isFinite(result.expires_at) ? Math.min(now()+result.expires_in*1000,result.expires_at*1000) : now()+result.expires_in*1000;
        const user = await request('/user','GET',null,bearer); current(g);
        if (now() >= expiresAt) throw Error('This email session expired. Request a new link.');
        if (!validUser(user) || user.id !== result.user.id || user.email !== result.user.email) throw Error('The verified account changed. Request a new link.');
        if (purpose === 'signup') { phase = 'confirmed'; revoke(bearer); bearer = null; return; }
        session = {owner:user.id,email:user.email,bearer,expiresAt};
        phase = 'password'; bearer = null;
      } catch (error) { revoke(bearer); if (g === generation) { phase = 'invalid'; session = null; } throw error; }
      finally { busy = false; }
    },
    async updatePassword(password, confirmation) {
      const error = passwordError(password,confirmation); if (error) throw Error(error);
      if (busy || phase !== 'password' || expired()) throw Error('This reset session expired. Request a new email link.');
      busy = true; const g = generation, active = session;
      try {
        const user = await request('/user','GET',null,active.bearer); current(g);
        if (expired() || !validUser(user) || user.id !== active.owner || user.email !== active.email) throw Error('The verified account changed. Request a new link.');
        const updated = await request('/user','PUT',{password},active.bearer); current(g);
        if (!validUser(updated) || updated.id !== active.owner || updated.email !== active.email) throw Error('The password change could not be confirmed. Return to Incrementum to sign in or request a new reset.');
        phase = 'updated'; session = null; revoke(active.bearer);
      } catch (error) { if (g === generation) {phase='invalid';session=null;revoke(active.bearer);} throw error; }
      finally { busy = false; }
    },
    cancel() {
      generation++; proof = null; const bearer = session?.bearer; session = null; phase = 'cancelled';
      for (const controller of controllers) controller.abort(); revoke(bearer);
    },
  };
}
