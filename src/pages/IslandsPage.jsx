import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ISLAND_PRESETS } from '../data/presets.js'
import { buildIslandBitmap } from '../utils/islandRenderer.js'
import './IslandsPage.css'

const STORAGE_KEY = 'islands'
const THUMB_SIZE  = 80

function loadIslands() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveIslands(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

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
  const [islands, setIslands] = useState(() => loadIslands())
  const navigate = useNavigate()

  function deleteIsland(id) {
    if (!confirm('Delete this island? This cannot be undone.')) return
    const next = islands.filter(i => i.id !== id)
    setIslands(next)
    saveIslands(next)
  }

  return (
    <div className="islands-screen">

      <div className="islands-header pixel-box">
        <span className="islands-title">Island of Life</span>
        <div className="islands-header-right">
          <button
            className="pixel-btn pixel-btn--outline"
            onClick={() => navigate('/showcase')}
          >
            Showcase
          </button>
        </div>
      </div>

      <div className="islands-body">

        <div className="islands-section-label">Your Islands</div>

        {islands.length === 0 && (
          <div className="islands-empty">No islands yet. Create your first one!</div>
        )}

        {islands.length > 0 && (
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
