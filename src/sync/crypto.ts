// Cifrado de extremo a extremo con WebCrypto.
//
// De la contraseña se deriva una clave maestra (PBKDF2, sal = email). De ella salen:
//  · authSecret: lo que se manda al servidor como "contraseña" de la cuenta.
//    El servidor nunca ve la contraseña real, así que no puede derivar la clave.
//  · encKey: AES-GCM para cifrar cada registro.
//  · idKey: HMAC para que los identificadores de los registros (p. ej. la fecha
//    de una entrada) no queden legibles en el servidor.
//
// Consecuencia: si se olvida la contraseña, los datos de la cuenta no se pueden recuperar.

export const KDF_ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface AccountKeys {
  encKey: CryptoKey;
  idKey: CryptoKey;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hkdf(master: CryptoKey, info: string, length = 256): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(info) },
    master,
    length,
  );
}

export async function deriveAccount(
  email: string,
  password: string,
  iterations = KDF_ITERATIONS,
): Promise<{ authSecret: string; keys: AccountKeys }> {
  const pw = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const masterBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`soma.v1|${normalizeEmail(email)}`), iterations },
    pw,
    256,
  );
  const master = await crypto.subtle.importKey('raw', masterBits, 'HKDF', false, ['deriveBits']);

  const authSecret = toB64(await hkdf(master, 'soma/auth'));
  const encKey = await crypto.subtle.importKey('raw', await hkdf(master, 'soma/enc'), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  const idKey = await crypto.subtle.importKey(
    'raw',
    await hkdf(master, 'soma/id'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return { authSecret, keys: { encKey, idKey } };
}

export async function recordId(idKey: CryptoKey, kind: string, key: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', idKey, enc.encode(`${kind}:${key}`));
  return toB64(sig);
}

export interface Sealed {
  iv: string;
  ciphertext: string;
}

/** El id del registro va como dato asociado: un texto cifrado no se puede mover a otro id. */
export async function seal(encKey: CryptoKey, id: string, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(id) },
    encKey,
    enc.encode(JSON.stringify(value)),
  );
  return { iv: toB64(iv), ciphertext: toB64(ct) };
}

export async function open<T>(encKey: CryptoKey, id: string, sealed: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: enc.encode(id) },
    encKey,
    fromB64(sealed.ciphertext),
  );
  return JSON.parse(dec.decode(pt)) as T;
}
