import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CreateIslandPage.css'

export default function CreateIslandPage() {
  const [name,  setName]  = useState('')
  const [error, setError] = useState('')
  const [busy,  setBusy]  = useState(false)
  const navigate = useNavigate()

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Please name your island.')
    setError('')
    setBusy(true)
    try {
      const r    = await fetch('/api/islands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), preset: 'standard' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      navigate(`/game/${data.id}`, { state: { island: data, isNew: true } })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="create-screen">
      <div className="create-card pixel-box">

        <div className="create-header">
          <button className="back-btn" onClick={() => navigate('/islands')}>← Back</button>
          <span className="create-title">New Island</span>
        </div>

        <form onSubmit={handleCreate}>
          <div className="create-section-label">Island Name</div>
          <input
            className="auth-input create-name-input"
            type="text"
            placeholder="e.g. Eden Isle"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
            spellCheck={false}
            required
          />

          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

          <button className="pixel-btn create-submit" type="submit" disabled={busy}>
            {busy ? '...' : 'Create Island'}
          </button>
        </form>

      </div>
    </div>
  )
}
