import { useState } from 'react'
import { auth } from '../api'

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await auth.login(password)
      if (!res.ok) {
        setError(res.status === 401 ? 'Incorrect password' : `Login failed (HTTP ${res.status})`)
        return
      }
      onSuccess()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>praveenchatbot</h1>
        <p className="login-sub">Enter the password to continue.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Password"
        />
        {error && <div className="login-error">{error}</div>}
        <button onClick={submit} disabled={busy}>{busy ? 'Checking…' : 'Enter'}</button>
      </div>
    </div>
  )
}
