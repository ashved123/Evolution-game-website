import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ISLAND_PRESETS } from '../data/presets.js'
import { buildIslandBitmap } from '../utils/islandRenderer.js'
import './CreateIslandPage.css'

const PREVIEW_SIZE = 110

function PresetCard({ preset, selected, onSelect }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const bmp = buildIslandBitmap(preset.id, PREVIEW_SIZE)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    ctx.drawImage(bmp, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
  }, [preset.id])

  return (
    <button
      className={`preset-card ${selected ? 'preset-card--selected' : ''}`}
      onClick={() => onSelect(preset.id)}
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_SIZE}
        height={PREVIEW_SIZE}
        className="preset-canvas"
      />
      <div className="preset-label">{preset.label}</div>
      <div className="preset-desc">{preset.desc}</div>
    </button>
  )
}

export default function CreateIslandPage() {
  const [name,     setName]     = useState('')
  const [preset,   setPreset]   = useState('standard')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)
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
        body: JSON.stringify({ name: name.trim(), preset }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      navigate('/islands')
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

          <div className="create-section-label" style={{ marginTop: 20 }}>Choose a Preset</div>
          <div className="preset-grid">
            {Object.values(ISLAND_PRESETS).map(p => (
              <PresetCard
                key={p.id}
                preset={p}
                selected={preset === p.id}
                onSelect={setPreset}
              />
            ))}
          </div>

          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

          <button className="pixel-btn create-submit" type="submit" disabled={busy}>
            {busy ? '...' : 'Create Island'}
          </button>
        </form>

      </div>
    </div>
  )
}
