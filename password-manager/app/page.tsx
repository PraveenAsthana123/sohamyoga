'use client';
// Zero-knowledge password manager. All encryption/decryption happens here,
// client-side, via Web Crypto. The derived Master Key and Vault Key live
// only in React state (memory) -- never localStorage, never sent to the
// server. Reloading the page requires re-entering the master password by
// design (this is the correct, secure default for a password manager).

import { useState, useCallback } from 'react';
import {
  randomSaltB64, deriveMasterKey, deriveAuthHash, generateVaultKey,
  encryptWithKey, decryptWithKey, exportKeyRaw, importKeyRaw, PBKDF2_ITERATIONS,
} from '@/lib/crypto-client';

interface VaultItemPlain { label: string; username: string; password: string; url: string; notes: string }
interface VaultItemRow { id: string; ciphertext: string; iv: string }
interface DecryptedItem extends VaultItemPlain { id: string }

export default function App() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [newItem, setNewItem] = useState<VaultItemPlain>({ label: '', username: '', password: '', url: '', notes: '' });

  const loadAndDecryptItems = useCallback(async (key: CryptoKey) => {
    const res = await fetch('/api/vault/items', { cache: 'no-store' });
    const body = await res.json();
    const rows = (body.items ?? []) as VaultItemRow[];
    const decrypted: DecryptedItem[] = [];
    for (const row of rows) {
      try {
        const plain = JSON.parse(await decryptWithKey(key, row.ciphertext, row.iv)) as VaultItemPlain;
        decrypted.push({ id: row.id, ...plain });
      } catch {
        // A ciphertext that fails to decrypt with this key is skipped, never
        // shown as garbage -- this should only happen if data was corrupted.
      }
    }
    setItems(decrypted);
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const kdfSalt = randomSaltB64();
      const masterKey = await deriveMasterKey(masterPassword, kdfSalt, PBKDF2_ITERATIONS);
      const authHash = await deriveAuthHash(masterKey, masterPassword);

      const vKey = await generateVaultKey();
      const rawVaultKey = await exportKeyRaw(vKey);
      const { ciphertext: encryptedVaultKey, iv: encryptedVaultKeyIv } = await encryptWithKey(masterKey, rawVaultKey);

      const res = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, kdfSalt, kdfIterations: PBKDF2_ITERATIONS, authHash, encryptedVaultKey, encryptedVaultKeyIv }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? 'Signup failed.'); return; }
      setVaultKey(vKey);
      await loadAndDecryptItems(vKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const paramsRes = await fetch(`/api/auth/kdf-params?email=${encodeURIComponent(email)}`);
      const params = await paramsRes.json();
      const masterKey = await deriveMasterKey(masterPassword, params.kdfSalt, params.kdfIterations);
      const authHash = await deriveAuthHash(masterKey, masterPassword);

      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, authHash }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? 'Login failed.'); return; }

      const rawVaultKey = await decryptWithKey(masterKey, body.encryptedVaultKey, body.encryptedVaultKeyIv);
      const vKey = await importKeyRaw(rawVaultKey);
      setVaultKey(vKey);
      await loadAndDecryptItems(vKey);
    } catch {
      setError('Invalid email or master password.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultKey) return;
    const { ciphertext, iv } = await encryptWithKey(vaultKey, JSON.stringify(newItem));
    const res = await fetch('/api/vault/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ciphertext, iv }),
    });
    if (res.ok) {
      setNewItem({ label: '', username: '', password: '', url: '', notes: '' });
      await loadAndDecryptItems(vaultKey);
    }
  }

  async function handleDelete(id: string) {
    if (!vaultKey) return;
    await fetch(`/api/vault/items/${id}`, { method: 'DELETE' });
    await loadAndDecryptItems(vaultKey);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setVaultKey(null); setItems([]); setEmail(''); setMasterPassword('');
  }

  if (!vaultKey) {
    return (
      <main className="mx-auto max-w-sm px-6 py-20">
        <h1 className="text-2xl font-bold text-gray-900">Password Manager</h1>
        <p className="text-sm text-gray-500 mb-6">Zero-knowledge: your master password never leaves this browser.</p>
        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-3">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2" />
          <input type="password" required minLength={8} value={masterPassword} onChange={e => setMasterPassword(e.target.value)} placeholder="Master password (min 8 chars)" className="w-full border rounded-lg px-3 py-2" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null); }} className="mt-3 text-sm text-indigo-600 hover:underline">
          {mode === 'login' ? "Need an account? Sign up" : 'Have an account? Log in'}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vault</h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:underline">Log out</button>
      </div>

      <form onSubmit={handleAddItem} className="bg-white border rounded-lg p-4 mb-6 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input required value={newItem.label} onChange={e => setNewItem(v => ({ ...v, label: e.target.value }))} placeholder="Label (e.g. GitHub)" className="border rounded px-2 py-1.5 text-sm" />
          <input value={newItem.url} onChange={e => setNewItem(v => ({ ...v, url: e.target.value }))} placeholder="URL" className="border rounded px-2 py-1.5 text-sm" />
          <input value={newItem.username} onChange={e => setNewItem(v => ({ ...v, username: e.target.value }))} placeholder="Username" className="border rounded px-2 py-1.5 text-sm" />
          <input required value={newItem.password} onChange={e => setNewItem(v => ({ ...v, password: e.target.value }))} placeholder="Password" className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <textarea value={newItem.notes} onChange={e => setNewItem(v => ({ ...v, notes: e.target.value }))} placeholder="Notes" className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
        <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm">+ Add item</button>
      </form>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-white border rounded-lg p-3 flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-500">{item.username} {item.url && `· ${item.url}`}</p>
              <p className="text-xs text-gray-400 font-mono">{item.password}</p>
              {item.notes && <p className="text-xs text-gray-400 mt-1">{item.notes}</p>}
            </div>
            <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:underline">Delete</button>
          </div>
        ))}
        {!items.length && <p className="text-sm text-gray-400 text-center py-8">No items yet — add one above.</p>}
      </div>
    </main>
  );
}
