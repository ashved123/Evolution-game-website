import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CreateIslandPage.css'

const STORAGE_KEY = 'islands'

function loadIslands() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export default function CreateIslandPage() {
  const [name,  setName]  = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Please name your island.')
    const island = {
      id:         createId(),
      name:       name.trim(),
      preset:     'standard',
      created_at: new Date().toISOString(),
    }
    const islands = [...loadIslands(), island]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(islands))
    navigate(`/game/${island.id}`, { state: { island, isNew: true } })
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

          <button className="pixel-btn create-submit" type="submit">
            Create Island
          </button>
        </form>

        <div className="create-foster-divider" />
        <button
          className="pixel-btn create-foster-btn"
          onClick={() => navigate('/showcase')}
        >
          CLICK THIS IF YOU ARE MR. FOSTER
        </button>

      </div>
    </div>
  )
}
