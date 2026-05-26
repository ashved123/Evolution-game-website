import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ISLAND_PRESETS } from '../data/presets.js'
import { buildIslandBitmap } from '../utils/islandRenderer.js'
import './IslandsPage.css'

const THUMB_SIZE = 80

function IslandThumb({ preset }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const bmp = buildIslandBitmap(preset, THUMB_SIZE)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(bmp, 0, 0, THUMB_SIZE, THUMB_SIZE)
  }, [preset])
  return <canvas ref={canvasRef} width={THUMB_SIZE} height={THUMB_SIZE} className="island-thumb" />
}

export default function IslandsPage() {
  const [islands, setIslands] = useState([])
  const [loading, setLoading] = useState(true)
  const { user, logout }      = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/islands')
      .then(r => r.json())
      .then(data => { setIslands(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deleteIsland(id) {
    if (!confirm('Delete this island? This cannot be undone.')) return
    await fetch(`/api/islands/${id}`, { method: 'DELETE' })
    setIslands(prev => prev.filter(i => i.id !== id))
  }

  async function handleLogout() {
    await logout()
    navigate('/auth')
  }

  return (
    <div className="islands-screen">

      <div className="islands-header pixel-box">
        <span className="islands-title">Island of Life</span>
        <div className="islands-header-right">
          <span className="islands-user">{user?.username}</span>
          <button className="pixel-btn pixel-btn--outline logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      <div className="islands-body">

        <div className="islands-section-label">Your Islands</div>

        {loading && <div className="islands-empty">Loading...</div>}

        {!loading && islands.length === 0 && (
          <div className="islands-empty">
            No islands yet. Create your first one!
          </div>
        )}

        {!loading && islands.length > 0 && (
          <div className="islands-grid">
            {islands.map(island => (
              <div key={island.id} className="island-card pixel-box">
                <IslandThumb preset={island.preset} />
                <div className="island-card-info">
                  <div className="island-card-name">{island.name}</div>
                  <div className="island-card-meta">
                    {ISLAND_PRESETS[island.preset]?.label ?? island.preset}
                  </div>
                  <div className="island-card-meta">
                    {new Date(island.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="island-card-actions">
                  <button
                    className="pixel-btn"
                    onClick={() => navigate(`/game/${island.id}`, { state: { island } })}
                  >
                    Play
                  </button>
                  <button
                    className="pixel-btn pixel-btn--outline"
                    onClick={() => deleteIsland(island.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          className="pixel-btn new-island-btn"
          onClick={() => navigate('/create-island')}
        >
          + New Island
        </button>

      </div>
    </div>
  )
}
