// Zero-knowledge client-side crypto. Runs ONLY in the browser (Web Crypto
// API). The server never receives a master password, master key, vault key,
// or plaintext vault item -- everything here happens before any network call.

const PBKDF2_ITERATIONS_DEFAULT = 600_000; // matches Bitwarden's real-world default
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Uint8Array(bytes.buffer.slice(0));
}

export function randomSaltB64(bytes = 16): string {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

async function pbkdf2(password: string, saltB64: string, iterations: number, bits: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: bits },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** Derives the user's Master Key from their master password. Never sent to the server. */
export async function deriveMasterKey(masterPassword: string, saltB64: string, iterations = PBKDF2_ITERATIONS_DEFAULT): Promise<CryptoKey> {
  return pbkdf2(masterPassword, saltB64, iterations, 256);
}

/** Derives the server-facing auth credential from the Master Key -- a one-way
 * function of the Master Key, not the Master Key itself, and not reversible
 * to it (different salt, single extra PBKDF2 round keyed by the raw key bytes). */
export async function deriveAuthHash(masterKey: CryptoKey, masterPasswordAsSalt: string): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', masterKey);
  const keyMaterial = await crypto.subtle.importKey('raw', rawKey, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(masterPasswordAsSalt), iterations: 1, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return toB64(bits);
}

export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { ciphertext: toB64(ct), iv: toB64(iv.buffer) };
}

export async function decryptWithKey(key: CryptoKey, ciphertextB64: string, ivB64: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ciphertextB64));
  return dec.decode(pt);
}

export async function exportKeyRaw(key: CryptoKey): Promise<string> {
  return toB64(await crypto.subtle.exportKey('raw', key));
}
export async function importKeyRaw(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64(rawB64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export const PBKDF2_ITERATIONS = PBKDF2_ITERATIONS_DEFAULT;
