import React, { useRef, useEffect, useCallback } from 'react'
import './IslandCanvas.css'

const PLACEHOLDER_SPECIES = [
  { id: 'grass',  emoji: '🌿', label: 'Island Grass',  x: 0.35, y: 0.55, color: '#4caf50' },
  { id: 'beetle', emoji: '🪲', label: 'Rock Beetle',   x: 0.50, y: 0.60, color: '#8d6e63' },
  { id: 'deer',   emoji: '🦌', label: 'Leaf Deer',     x: 0.45, y: 0.40, color: '#a5d6a7' },
  { id: 'frog',   emoji: '🐸', label: 'Marsh Frog',    x: 0.25, y: 0.65, color: '#66bb6a' },
  { id: 'hawk',   emoji: '🦅', label: 'Island Hawk',   x: 0.60, y: 0.30, color: '#ff7043' },
  { id: 'fungi',  emoji: '🍄', label: 'Fungi',         x: 0.70, y: 0.65, color: '#ce93d8' },
]

const MIN_SCALE = 0.3
const MAX_SCALE = 5.0

export default function IslandCanvas({ speed, onSelectSpecies }) {
  const canvasRef   = useRef(null)
  const wrapRef     = useRef(null)
  const hotspotRef  = useRef(null)
  const vpRef       = useRef({ scale: 1, panX: 0, panY: 0 })
  const sizeRef     = useRef({ width: 0, height: 0 })
  const dragging      = useRef(false)
  const lastMouse     = useRef({ x: 0, y: 0 })
  const wheelHandler  = useRef(null)  // updated each render, called by stable listener

  // ── apply a viewport to both canvas and hotspot overlay ─────────
  const applyViewport = useCallback((vp) => {
    vpRef.current = vp
    const canvas = canvasRef.current
    if (canvas) {
      const { width, height } = sizeRef.current
      const dpr = window.devicePixelRatio || 1
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(vp.panX, vp.panY)
      ctx.scale(vp.scale, vp.scale)
      drawIsland(ctx, width, height)
      ctx.restore()
    }
    if (hotspotRef.current) {
      hotspotRef.current.style.transform =
        `translate(${vp.panX}px,${vp.panY}px) scale(${vp.scale})`
    }
  }, [])

  // ── keep canvas pixel-resolution in sync with wrapper size ──────
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const { width, height } = wrap.getBoundingClientRect()
    sizeRef.current = { width, height }
    const dpr = window.devicePixelRatio || 1
    canvas.width  = Math.round(width  * dpr)
    canvas.height = Math.round(height * dpr)
    applyViewport(vpRef.current)
  }, [applyViewport])

  useEffect(() => {
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [resize])

  // ── clamp pan so island never fully leaves screen ────────────────
  function clamp(vp) {
    const { width: w, height: h } = sizeRef.current
    const margin = 120
    return {
      ...vp,
      panX: Math.max(margin - w * vp.scale, Math.min(w - margin, vp.panX)),
      panY: Math.max(margin - h * vp.scale, Math.min(h - margin, vp.panY)),
    }
  }

  // ── zoom toward a point in screen space ─────────────────────────
  function zoomAt(sx, sy, factor) {
    const vp = vpRef.current
    const s  = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * factor))
    const r  = s / vp.scale
    applyViewport(clamp({ scale: s, panX: sx - (sx - vp.panX) * r, panY: sy - (sy - vp.panY) * r }))
  }

  // ── wheel zoom — registered as non-passive native listener ────────
  // (React onWheel is passive in some environments so preventDefault is ignored)
  wheelHandler.current = (e) => {
    e.preventDefault()
    const rect = wrapRef.current.getBoundingClientRect()
    // Normalise delta across deltaMode values and clamp so one mouse-wheel notch
    // doesn't jump too far, while letting trackpad give smooth proportional zoom.
    let d = e.deltaY
    if (e.deltaMode === 1) d *= 15   // line mode → pixels
    if (e.deltaMode === 2) d *= 300  // page mode → pixels
    d = Math.sign(d) * Math.min(Math.abs(d), 100)
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.pow(0.999, d))
  }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const listener = (e) => wheelHandler.current(e)
    wrap.addEventListener('wheel', listener, { passive: false })
    return () => wrap.removeEventListener('wheel', listener)
  }, [])

  // ── mouse drag → pan ─────────────────────────────────────────────
  function handleMouseDown(e) {
    if (e.button !== 0) return
    dragging.current  = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    wrapRef.current.style.cursor = 'grabbing'
  }

  function handleMouseMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    const vp = vpRef.current
    applyViewport(clamp({ ...vp, panX: vp.panX + dx, panY: vp.panY + dy }))
  }

  function stopDrag() {
    dragging.current = false
    if (wrapRef.current) wrapRef.current.style.cursor = ''
  }

  // ── keyboard → pan + zoom ────────────────────────────────────────
  function handleKeyDown(e) {
    const { width: w, height: h } = sizeRef.current
    const vp   = vpRef.current
    const STEP = 60
    let next   = { ...vp }

    switch (e.key) {
      case 'ArrowLeft':  next.panX += STEP; break
      case 'ArrowRight': next.panX -= STEP; break
      case 'ArrowUp':    next.panY += STEP; break
      case 'ArrowDown':  next.panY -= STEP; break
      case '+': case '=': zoomAt(w / 2, h / 2, 1.2); return
      case '-':           zoomAt(w / 2, h / 2, 1 / 1.2); return
      case '0': applyViewport({ scale: 1, panX: 0, panY: 0 }); return
      default: return
    }
    e.preventDefault()
    applyViewport(clamp(next))
  }

  return (
    <div
      className="island-canvas-wrap"
      ref={wrapRef}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onKeyDown={handleKeyDown}
    >
      <canvas ref={canvasRef} className="island-canvas" />

      {/* Hotspot overlay — CSS-transformed in sync with canvas */}
      <div className="island-hotspots" ref={hotspotRef} style={{ transformOrigin: '0 0' }}>
        {PLACEHOLDER_SPECIES.map(sp => (
          <button
            key={sp.id}
            className="island-hotspot"
            style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }}
            title={sp.label}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onSelectSpecies(sp)}
          >
            <span className="island-hotspot__emoji">{sp.emoji}</span>
            <span className="island-hotspot__label">{sp.label}</span>
          </button>
        ))}
      </div>

      <div className="island-hint">
        scroll to zoom · drag to pan · ←↑↓→ · +/− · 0 reset
      </div>
    </div>
  )
}

// ── island drawing (unchanged logic) ────────────────────────────────
function drawIsland(ctx, w, h) {
  const cx = w * 0.50
  const cy = h * 0.52
  const Rx = w * 0.23
  const Ry = h * 0.21

  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }

  function polarPts(spec, sx = 1, sy = 1) {
    return spec.map(([deg, r]) => {
      const rad = (deg * Math.PI) / 180
      return { x: cx + Math.cos(rad) * Rx * r * sx, y: cy + Math.sin(rad) * Ry * r * sy }
    })
  }

  function smoothPoly(pts) {
    const n = pts.length
    const s = mid(pts[n - 1], pts[0])
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n])
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y)
    }
    ctx.closePath()
  }

  const SPEC = [
    [  0, 1.00], [ 18, 0.88], [ 36, 0.68], [ 54, 0.82], [ 72, 0.96],
    [ 90, 1.04], [108, 1.20], [126, 1.12], [144, 1.02], [162, 0.93],
    [180, 0.90], [198, 1.00], [216, 1.08], [234, 0.88], [252, 1.05],
    [270, 1.12], [288, 0.84], [306, 0.78], [324, 0.94], [342, 1.02],
  ]

  const islandPts  = polarPts(SPEC, 1.00, 1.00)
  const beachPts   = polarPts(SPEC, 1.15, 1.14)
  const shallowPts = polarPts(SPEC, 1.34, 1.32)

  ctx.fillStyle = '#7ab4cc'; ctx.fillRect(0, 0, w, h)
  smoothPoly(shallowPts); ctx.fillStyle = '#a8d8e8'; ctx.fill()
  smoothPoly(beachPts);   ctx.fillStyle = '#e0c890'; ctx.fill()
  smoothPoly(islandPts);  ctx.fillStyle = '#90b870'; ctx.fill()

  ctx.fillStyle = '#ffffff18'
  ctx.font = '7px "Press Start 2P", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('[ ISLAND VIEW ]', 10, 10)
  ctx.fillText('click a species to edit its DNA', 10, 24)
}
