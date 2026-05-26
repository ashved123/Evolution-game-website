import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import './IslandCanvas.css'
import { BIOMES } from '../data/biomes'
import { ISLAND_PRESETS } from '../data/presets'
import { SPECIES } from '../data/species.js'
import { applyDNA } from '../data/codons.js'
import IndividualCard from './IndividualCard.jsx'
import grassSvg  from '../assets/species/island_grass.svg'
import figSvg    from '../assets/species/island_fig.svg'
import beetleSvg from '../assets/species/rock_beetle.svg'
import deerSvg   from '../assets/species/leaf_deer.svg'
import frogSvg   from '../assets/species/marsh_frog.svg'
import hawkSvg   from '../assets/species/island_hawk.svg'
import fungiSvg  from '../assets/species/shelf_fungi.svg'

// ── constants ────────────────────────────────────────────────────────

const SPECIES_SVG = {
  grass: grassSvg, tree: figSvg, beetle: beetleSvg,
  deer: deerSvg, frog: frogSvg, hawk: hawkSvg, fungi: fungiSvg,
}

const SPECIES_PIXEL_COLOR = {
  grass: '#b5f542', tree: '#1de08a', beetle: '#c46200',
  deer: '#f5d142', frog: '#00e5ff', hawk: '#ff4081', fungi: '#e040fb',
}

// Plants don't move — only animals do.
const STATIONARY_SPECIES = new Set(['grass', 'tree', 'fungi'])

// Which biomes each species actively prefers to live in.
// Movement steers toward home if an individual wanders outside these.
const SPECIES_BIOME_PREF = {
  grass:  ['GRASSLAND', 'WETLAND', 'FOREST'],
  tree:   ['FOREST', 'WETLAND'],
  beetle: ['GRASSLAND', 'FOREST', 'HIGHLAND'],
  deer:   ['GRASSLAND', 'FOREST', 'HIGHLAND'],
  frog:   ['WETLAND', 'GRASSLAND', 'FOREST'],
  hawk:   ['HIGHLAND', 'ROCKY_PEAK', 'FOREST'],
  fungi:  ['FOREST', 'WETLAND', 'HIGHLAND'],
}

// Fitness penalty per biome tier — used for biome-based death selection
// (positive = extra pressure to die if in a non-preferred biome)
const BIOME_HAZARD = Object.fromEntries(
  Object.entries(BIOMES).map(([id, b]) => [id, b.hazard ?? 0])
)

const svgImages = Object.fromEntries(
  Object.entries(SPECIES_SVG).map(([id, src]) => {
    const img = new Image(); img.src = src; return [id, img]
  })
)

const WORLD_W    = 4000
const WORLD_H    = 4000
const ART_W      = 400
const ART_H      = 400
const PIXEL_SIZE = 4
const MIN_SCALE  = 0.04
const MAX_SCALE  = 8.0
const ZOOM_THRESHOLD = 1.5
const SPRITE_SCALE   = 0.25
const MAX_SPEED      = 5   // world units per frame at speed stat = 100

// Scatter offsets used only for initial position seeding — not for live drawing
const SCATTER = (() => {
  const out = {}
  for (const id of Object.keys(SPECIES_PIXEL_COLOR)) {
    let s = id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 1)
    const rnd = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
    const positions = Array.from({ length: 300 }, () => ({
      angle: rnd() * Math.PI * 2, r: Math.sqrt(rnd()),
    }))
    if (id === 'grass') positions.sort((a, b) => a.r - b.r)
    out[id] = positions
  }
  return out
})()

const DOT_RADIUS = {
  grass: 700, tree: 80, beetle: 110, deer: 170, frog: 100, hawk: 240, fungi: 90,
}

// ── biome palette ────────────────────────────────────────────────────

function hexRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const PALETTE   = Object.values(BIOMES).map(b => hexRgb(b.color))
const BIOME_IDS = Object.keys(BIOMES)

function snapToPalette(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    let minDist = Infinity, best = PALETTE[0]
    for (const c of PALETTE) {
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2
      if (d < minDist) { minDist = d; best = c }
    }
    data[i] = best[0]; data[i + 1] = best[1]; data[i + 2] = best[2]
  }
  ctx.putImageData(img, 0, 0)
}

// Build a biome lookup closure from a 400×400 offscreen island render.
// Returns biomeAt(worldX, worldY) → biome ID string.
function buildBiomeMap(presetId) {
  const off = document.createElement('canvas')
  off.width  = ART_W
  off.height = ART_H
  const ctx = off.getContext('2d')
  ctx.setTransform(ART_W / WORLD_W, 0, 0, ART_H / WORLD_H, 0, 0)
  drawIsland(ctx, presetId)
  snapToPalette(ctx, ART_W, ART_H)
  const data = ctx.getImageData(0, 0, ART_W, ART_H).data

  return function biomeAt(wx, wy) {
    const ax = Math.min(ART_W - 1, Math.max(0, Math.round(wx / WORLD_W * ART_W)))
    const ay = Math.min(ART_H - 1, Math.max(0, Math.round(wy / WORLD_H * ART_H)))
    const i  = (ay * ART_W + ax) * 4
    const r = data[i], g = data[i + 1], b = data[i + 2]
    let minDist = Infinity, bestIdx = 0
    for (let j = 0; j < PALETTE.length; j++) {
      const c = PALETTE[j]
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2
      if (d < minDist) { minDist = d; bestIdx = j }
    }
    return BIOME_IDS[bestIdx]
  }
}

// ── island geometry ──────────────────────────────────────────────────

const VARS = {
  grass:   [1.00,0.92,1.08,0.88,0.96,1.10,0.84,1.02,1.00,0.90,1.06,0.86,0.98,1.12,0.88,0.96],
  forest:  [0.92,1.10,0.84,1.02,1.12,0.86,0.98,1.06,0.90,1.00,0.82,1.08,0.94,0.88,1.10,0.96],
  wetland: [1.08,0.88,1.00,0.84,1.10,0.96,0.86,1.04,1.00,0.90,1.08,0.82,1.00,0.92,0.86,1.06],
  high:    [0.94,1.06,0.86,1.00,0.90,1.10,0.82,0.98,1.08,0.88,1.02,0.84,0.96,1.06,0.88,1.00],
  peak:    [1.00,0.88,1.10,0.82,1.00,0.90,1.08,0.84,1.00,0.92,0.86,1.06,0.94,0.88,1.10,0.96],
}

const GC = { cx: 200, cy: 195, rx: 68, ry: 60 }
const FC = { cx:  90, cy:  85 }
const WC = { cx: 318, cy:  88 }
const HC = { cx: 200, cy: 318 }

function ellipseEdge(cx, cy, rx, ry, tx, ty) {
  const dx = tx - cx, dy = ty - cy
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len, uy = dy / len
  const t = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2)
  return [Math.round(cx + ux * t), Math.round(cy + uy * t)]
}

function getIslandConfig(presetId) {
  const p = ISLAND_PRESETS[presetId] ?? ISLAND_PRESETS.standard

  const forestRx = Math.round(55 * p.forest   / 0.72)
  const forestRy = Math.round(48 * p.forest   / 0.72)
  const highRx   = Math.round(52 * p.highland / 0.42)
  const highRy   = Math.min(HC.cy - GC.cy - GC.ry - 4, Math.round(47 * p.highland / 0.42))
  const peakRx   = Math.round(20 * p.rocky    / 0.22)
  const peakRy   = Math.round(18 * p.rocky    / 0.22)

  const hasWetland = !!p.wetlandArc
  const arcWidth   = hasWetland ? (p.wetlandArc[1] - p.wetlandArc[0]) : 80
  const wetlandRx  = Math.round(47 * Math.sqrt(arcWidth / 80))
  const wetlandRy  = Math.round(42 * Math.sqrt(arcWidth / 80))

  const [gfx1, gfy1] = ellipseEdge(GC.cx, GC.cy, GC.rx,     GC.ry,     FC.cx, FC.cy)
  const [gfx2, gfy2] = ellipseEdge(FC.cx, FC.cy, forestRx,  forestRy,  GC.cx, GC.cy)
  const [gwx1, gwy1] = ellipseEdge(GC.cx, GC.cy, GC.rx,     GC.ry,     WC.cx, WC.cy)
  const [gwx2, gwy2] = ellipseEdge(WC.cx, WC.cy, wetlandRx, wetlandRy, GC.cx, GC.cy)

  const islands = [
    { key: 'grass',   cx: GC.cx, cy: GC.cy, rx: GC.rx,   ry: GC.ry,   vars: 'grass',   biome: 'GRASSLAND' },
    { key: 'forest',  cx: FC.cx, cy: FC.cy, rx: forestRx, ry: forestRy, vars: 'forest',  biome: 'FOREST'    },
    ...(hasWetland ? [{ key: 'wetland', cx: WC.cx, cy: WC.cy, rx: wetlandRx, ry: wetlandRy, vars: 'wetland', biome: 'WETLAND' }] : []),
    { key: 'high',    cx: HC.cx, cy: HC.cy, rx: highRx,   ry: highRy,   vars: 'high',    biome: 'HIGHLAND'  },
  ]

  const peak    = { cx: 200, cy: 316, rx: peakRx, ry: peakRy, vars: 'peak', biome: 'ROCKY_PEAK' }
  const bridges = [
    { x1: gfx1, y1: gfy1, x2: gfx2, y2: gfy2, bw: 12, sw: 20 },
    ...(hasWetland ? [{ x1: gwx1, y1: gwy1, x2: gwx2, y2: gwy2, bw: 11, sw: 19 }] : []),
    { x1: 200, y1: GC.cy + GC.ry, x2: 200, y2: HC.cy - highRy, bw: 14, sw: 23 },
  ]

  return { islands, peak, bridges }
}

function getHotspots(cfg) {
  const { islands } = cfg
  const grass   = islands.find(i => i.key === 'grass')
  const forest  = islands.find(i => i.key === 'forest')
  const wetland = islands.find(i => i.key === 'wetland')
  const high    = islands.find(i => i.key === 'high')
  const ax = x => x / ART_W, ay = y => y / ART_H
  return [
    { id: 'grass',  emoji: '🌿', label: 'Island Grass', x: ax(grass.cx),      y: ay(grass.cy + 16), color: '#4caf50' },
    { id: 'tree',   emoji: '🌳', label: 'Island Fig',   x: ax(forest.cx),     y: ay(forest.cy),     color: '#2e7d32' },
    { id: 'beetle', emoji: '🪲', label: 'Rock Beetle',  x: ax(grass.cx - 4),  y: ay(grass.cy - 8),  color: '#8d6e63' },
    { id: 'deer',   emoji: '🦌', label: 'Leaf Deer',    x: ax(grass.cx + 8),  y: ay(grass.cy + 24), color: '#a5d6a7' },
    wetland
      ? { id: 'frog', emoji: '🐸', label: 'Marsh Frog', x: ax(wetland.cx),    y: ay(wetland.cy),    color: '#66bb6a' }
      : { id: 'frog', emoji: '🐸', label: 'Marsh Frog', x: ax(grass.cx - 28), y: ay(grass.cy + 5),  color: '#66bb6a' },
    { id: 'hawk',  emoji: '🦅', label: 'Island Hawk',  x: ax(high.cx),       y: ay(high.cy - 12),  color: '#ff7043' },
    { id: 'fungi', emoji: '🍄', label: 'Shelf Fungi',  x: ax(high.cx),       y: ay(high.cy + 12),  color: '#ce93d8' },
  ]
}

function drawIsland(ctx, presetId) {
  const { islands, peak, bridges } = getIslandConfig(presetId)
  const sx = WORLD_W / ART_W, sy = WORLD_H / ART_H

  function blobPts(isl, s = 1) {
    const vars = VARS[isl.vars], n = vars.length
    return vars.map((v, i) => ({
      x: (isl.cx + Math.cos(i / n * Math.PI * 2) * isl.rx * s * v) * sx,
      y: (isl.cy + Math.sin(i / n * Math.PI * 2) * isl.ry * s * v) * sy,
    }))
  }
  function smoothFill(pts, color) {
    const n = pts.length
    ctx.beginPath()
    ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2)
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n]
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill()
  }
  function bridgeStroke(b, halfW, color) {
    ctx.strokeStyle = color; ctx.lineWidth = halfW * 2 * sx; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(b.x1 * sx, b.y1 * sy); ctx.lineTo(b.x2 * sx, b.y2 * sy); ctx.stroke()
  }

  ctx.fillStyle = BIOMES.DEEP_OCEAN.color
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  for (const isl of islands) smoothFill(blobPts(isl, 1.48), BIOMES.SHALLOW_WATER.color)
  for (const b of bridges)    bridgeStroke(b, b.sw, BIOMES.SHALLOW_WATER.color)
  for (const isl of islands) smoothFill(blobPts(isl, 1.18), BIOMES.BEACH.color)
  for (const b of bridges)    bridgeStroke(b, b.bw, BIOMES.BEACH.color)
  for (const isl of islands) smoothFill(blobPts(isl, 1.0), BIOMES[isl.biome].color)
  smoothFill(blobPts(peak, 1.0), BIOMES.ROCKY_PEAK.color)
}

// ── individual movement ──────────────────────────────────────────────

// Step all individual positions one frame.
// posMap: Map<id, {x,y,vx,vy}>
// resolvedBases: { [spId]: stats object }
function stepMovement(posMap, individuals, hotspots, biomeAt, resolvedBases, biomeScoresRef) {
  const hsMap = Object.fromEntries(hotspots.map(h => [h.id, h]))
  const scores = biomeScoresRef?.current ?? null

  for (const [spId, pool] of Object.entries(individuals)) {
    if (!pool.length) continue
    if (STATIONARY_SPECIES.has(spId)) continue   // plants don't move
    const hs    = hsMap[spId]
    if (!hs) continue
    const prefs = SPECIES_BIOME_PREF[spId] ?? []
    const base  = resolvedBases[spId] ?? {}
    const homeX = hs.x * WORLD_W
    const homeY = hs.y * WORLD_H
    if (scores && !scores[spId]) scores[spId] = {}

    for (const ind of pool) {
      const pos = posMap.get(ind.id)
      if (!pos) continue

      const effSpeed = Math.min(100, Math.max(0, (base.speed ?? 50) + (ind.variation?.speed ?? 0)))
      const maxSpd   = (effSpeed / 100) * MAX_SPEED

      // Random wander
      let ax = (Math.random() - 0.5) * 0.5
      let ay = (Math.random() - 0.5) * 0.5

      // Biome preference: steer home when in wrong biome or water
      const biome = biomeAt(pos.x, pos.y)
      const inWater = biome === 'DEEP_OCEAN' || biome === 'SHALLOW_WATER'
      const inPref  = !inWater && prefs.includes(biome)

      // Write biome fitness score for the simulation layer to consume
      if (scores) scores[spId][ind.id] = inPref

      if (!inPref) {
        const dx = homeX - pos.x, dy = homeY - pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const strength = inWater ? 4 : 2
        if (dist > 1) { ax += (dx / dist) * strength; ay += (dy / dist) * strength }
      }

      // Integrate velocity with damping
      pos.vx = (pos.vx + ax) * 0.80
      pos.vy = (pos.vy + ay) * 0.80
      const spd = Math.sqrt(pos.vx ** 2 + pos.vy ** 2)
      if (spd > maxSpd) { pos.vx = pos.vx / spd * maxSpd; pos.vy = pos.vy / spd * maxSpd }

      pos.x = Math.max(0, Math.min(WORLD_W, pos.x + pos.vx))
      pos.y = Math.max(0, Math.min(WORLD_H, pos.y + pos.vy))
    }
  }
}

// ── drawing ──────────────────────────────────────────────────────────

// Draw one 1×1 canvas pixel per individual (identity transform, integer snap)
function drawDots(ctx, hotspots, individuals, posMap, vp) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (const sp of hotspots) {
    const pool = individuals[sp.id] ?? []
    if (!pool.length) continue
    ctx.fillStyle = SPECIES_PIXEL_COLOR[sp.id] ?? sp.color
    for (const ind of pool) {
      const pos = posMap.get(ind.id)
      if (!pos) continue
      const cpx = Math.round((pos.x * vp.scale + vp.panX) / PIXEL_SIZE)
      const cpy = Math.round((pos.y * vp.scale + vp.panY) / PIXEL_SIZE)
      ctx.fillRect(cpx, cpy, 1, 1)
    }
  }
  ctx.restore()
}

// Draw SVG sprite at each individual's world position (full-res sprite canvas, world-space transform)
function drawSpritesFromMap(sprCtx, hotspots, individuals, posMap) {
  sprCtx.imageSmoothingEnabled = true
  for (const sp of hotspots) {
    const img = svgImages[sp.id]
    if (!img?.complete || !img.naturalWidth) continue
    const pool = individuals[sp.id] ?? []
    if (!pool.length) continue
    const w = img.naturalWidth  * SPRITE_SCALE
    const h = img.naturalHeight * SPRITE_SCALE
    for (const ind of pool) {
      const pos = posMap.get(ind.id)
      if (!pos) continue
      sprCtx.drawImage(img, pos.x - w / 2, pos.y - h, w, h)
    }
  }
}

function fitViewport(w, h) {
  const s = Math.min(w / WORLD_W, h / WORLD_H) * 0.92
  return { scale: s, panX: (w - WORLD_W * s) / 2, panY: (h - WORLD_H * s) / 2 }
}

// ── component ────────────────────────────────────────────────────────

export default function IslandCanvas({ speed, onSelectSpecies, preset = 'standard', pops = {}, individuals = {}, dnaOverrides = {}, biomeScoresRef = null }) {
  const canvasRef        = useRef(null)
  const spriteCanvasRef  = useRef(null)
  const wrapRef          = useRef(null)
  const hotspotRef       = useRef(null)
  const vpRef            = useRef(null)
  const sizeRef          = useRef({ width: 0, height: 0 })
  const dragging         = useRef(false)
  const dragMoved        = useRef(false)
  const lastMouse        = useRef({ x: 0, y: 0 })
  const wheelHandler     = useRef(null)
  const presetRef        = useRef(preset)
  presetRef.current      = preset
  const individualsRef   = useRef(individuals)
  individualsRef.current = individuals
  const dnaOverridesRef  = useRef(dnaOverrides)
  dnaOverridesRef.current = dnaOverrides

  // Individual positions — keyed by stable individual id, updated in RAF
  const positionsRef  = useRef(new Map())
  // Biome lookup function built from offscreen canvas
  const biomeMapRef   = useRef(null)
  // Cached island pixel data — restored each frame before drawing individuals
  const islandCacheRef = useRef(null)

  const [selectedInd, setSelectedInd] = useState(null)
  // { speciesId, indId, cssX, cssY }

  const hotspots    = useMemo(() => getHotspots(getIslandConfig(preset)), [preset])
  const hotspotsRef = useRef(hotspots)
  hotspotsRef.current = hotspots

  // ── Sync position map when individuals change ──────────────────────
  // Add positions for new IDs, remove dead IDs. Existing positions are untouched.
  useEffect(() => {
    const posMap     = positionsRef.current
    const biomeAt    = biomeMapRef.current
    const currentIds = new Set()

    for (const [spId, pool] of Object.entries(individuals)) {
      const hs = hotspots.find(h => h.id === spId)
      if (!hs) continue
      const offsets  = SCATTER[spId] ?? []
      const rad      = DOT_RADIUS[spId] ?? 120
      const homeX    = hs.x * WORLD_W
      const homeY    = hs.y * WORLD_H
      const needsLand = STATIONARY_SPECIES.has(spId) // plants must stay on land

      for (let i = 0; i < pool.length; i++) {
        const ind = pool[i]
        currentIds.add(ind.id)
        if (!posMap.has(ind.id)) {
          let x, y, placed = false
          // Try the seeded scatter offset first, then random retries to avoid water
          for (let attempt = 0; attempt < 25; attempt++) {
            const off   = attempt === 0 ? (offsets[i % offsets.length] ?? null) : null
            const angle = off ? off.angle : Math.random() * Math.PI * 2
            const r     = off ? off.r     : Math.sqrt(Math.random())
            x = homeX + Math.cos(angle) * r * rad
            y = homeY + Math.sin(angle) * r * rad
            if (!needsLand || !biomeAt) { placed = true; break }
            const biome = biomeAt(x, y)
            if (biome !== 'DEEP_OCEAN' && biome !== 'SHALLOW_WATER') { placed = true; break }
          }
          if (!placed) { x = homeX; y = homeY } // fallback: hotspot center
          posMap.set(ind.id, { x, y, vx: 0, vy: 0 })
        }
      }
    }

    for (const id of posMap.keys()) {
      if (!currentIds.has(id)) posMap.delete(id)
    }
  }, [individuals, hotspots])

  // ── Build biome map when preset changes ───────────────────────────
  useEffect(() => {
    biomeMapRef.current = buildBiomeMap(preset)
  }, [preset])

  // ── Redraw island and cache pixel data ────────────────────────────
  // Called on viewport changes. Individuals drawn separately by RAF loop.
  const applyViewport = useCallback((vp) => {
    vpRef.current = vp
    const canvas = canvasRef.current
    if (canvas) {
      const { width, height } = sizeRef.current
      const ctx = canvas.getContext('2d')
      ctx.setTransform(1 / PIXEL_SIZE, 0, 0, 1 / PIXEL_SIZE, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.translate(vp.panX, vp.panY)
      ctx.scale(vp.scale, vp.scale)
      ctx.imageSmoothingEnabled = true
      drawIsland(ctx, presetRef.current)
      ctx.restore()
      snapToPalette(ctx, canvas.width, canvas.height)
      // Cache the island so the RAF loop can restore it each frame
      islandCacheRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
    if (hotspotRef.current) {
      hotspotRef.current.style.transform =
        `translate(${vp.panX}px,${vp.panY}px) scale(${vp.scale})`
    }
  }, [])

  // ── RAF animation loop ─────────────────────────────────────────────
  // Moves individuals and redraws them every frame without touching React state.
  useEffect(() => {
    let rafId
    function frame() {
      const vp      = vpRef.current
      const canvas  = canvasRef.current
      const cache   = islandCacheRef.current
      const posMap  = positionsRef.current
      const biomeAt = biomeMapRef.current

      if (vp && canvas && cache && biomeAt) {
        // Compute current DNA-resolved base stats for each species
        const resolvedBases = {}
        for (const sp of SPECIES) {
          const dna = dnaOverridesRef.current[sp.id] ?? sp.dna
          resolvedBases[sp.id] = applyDNA(sp.stats, dna)
        }

        stepMovement(posMap, individualsRef.current, hotspotsRef.current, biomeAt, resolvedBases, biomeScoresRef)

        // Restore island (avoid expensive redraw each frame)
        const ctx = canvas.getContext('2d')
        ctx.putImageData(cache, 0, 0)
        drawDots(ctx, hotspotsRef.current, individualsRef.current, posMap, vp)

        // Sprite canvas
        const spriteCanvas = spriteCanvasRef.current
        if (spriteCanvas) {
          const dpr    = window.devicePixelRatio || 1
          const sprCtx = spriteCanvas.getContext('2d')
          sprCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height)
          if (vp.scale >= ZOOM_THRESHOLD) {
            sprCtx.save()
            sprCtx.setTransform(vp.scale * dpr, 0, 0, vp.scale * dpr, vp.panX * dpr, vp.panY * dpr)
            drawSpritesFromMap(sprCtx, hotspotsRef.current, individualsRef.current, posMap)
            sprCtx.restore()
          }
        }
      }
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [])  // runs once — reads everything from refs

  const resize = useCallback(() => {
    const canvas       = canvasRef.current
    const spriteCanvas = spriteCanvasRef.current
    const wrap         = wrapRef.current
    if (!canvas || !wrap) return
    const { width, height } = wrap.getBoundingClientRect()
    sizeRef.current = { width, height }
    canvas.width  = Math.ceil(width  / PIXEL_SIZE)
    canvas.height = Math.ceil(height / PIXEL_SIZE)
    if (spriteCanvas) {
      const dpr = window.devicePixelRatio || 1
      spriteCanvas.width  = Math.round(width  * dpr)
      spriteCanvas.height = Math.round(height * dpr)
    }
    if (!vpRef.current && width > 0) vpRef.current = fitViewport(width, height)
    applyViewport(vpRef.current)
  }, [applyViewport])

  useEffect(() => {
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [resize])

  useEffect(() => {
    const handlers = Object.values(svgImages)
      .filter(img => !img.complete)
      .map(img => {
        const fn = () => { if (vpRef.current) applyViewport(vpRef.current) }
        img.addEventListener('load', fn)
        return () => img.removeEventListener('load', fn)
      })
    return () => handlers.forEach(off => off())
  }, [applyViewport])

  useEffect(() => {
    if (vpRef.current) applyViewport(vpRef.current)
  }, [preset, applyViewport])

  // ── Viewport helpers ──────────────────────────────────────────────

  function clamp(vp) {
    const { width: w, height: h } = sizeRef.current
    const margin = 80
    return {
      ...vp,
      panX: Math.max(margin - WORLD_W * vp.scale, Math.min(w - margin, vp.panX)),
      panY: Math.max(margin - WORLD_H * vp.scale, Math.min(h - margin, vp.panY)),
    }
  }

  function zoomAt(sx, sy, factor) {
    const vp = vpRef.current; if (!vp) return
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * factor))
    const r = s / vp.scale
    applyViewport(clamp({ scale: s, panX: sx - (sx - vp.panX) * r, panY: sy - (sy - vp.panY) * r }))
  }

  wheelHandler.current = (e) => {
    e.preventDefault()
    const rect = wrapRef.current.getBoundingClientRect()
    let d = e.deltaY
    if (e.deltaMode === 1) d *= 15
    if (e.deltaMode === 2) d *= 300
    d = Math.sign(d) * Math.min(Math.abs(d), 100)
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.pow(0.999, d))
  }

  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return
    const listener = (e) => wheelHandler.current(e)
    wrap.addEventListener('wheel', listener, { passive: false })
    return () => wrap.removeEventListener('wheel', listener)
  }, [])

  // ── Click-to-select individual ────────────────────────────────────

  function pickIndividual(cssX, cssY) {
    const vp = vpRef.current
    if (!vp || vp.scale < ZOOM_THRESHOLD) return
    const wx = (cssX - vp.panX) / vp.scale
    const wy = (cssY - vp.panY) / vp.scale
    const PICK_RADIUS = 60
    let best = null, bestDist = Infinity

    for (const sp of hotspotsRef.current) {
      const pool = individualsRef.current[sp.id] ?? []
      for (const ind of pool) {
        const pos = positionsRef.current.get(ind.id)
        if (!pos) continue
        const dist = Math.sqrt((wx - pos.x) ** 2 + (wy - pos.y) ** 2)
        if (dist < PICK_RADIUS && dist < bestDist) {
          bestDist = dist
          best = { speciesId: sp.id, indId: ind.id, cssX, cssY }
        }
      }
    }
    if (best) setSelectedInd(best)
    else setSelectedInd(null)
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return
    dragging.current  = true
    dragMoved.current = false
    lastMouse.current = { x: e.clientX, y: e.clientY }
    wrapRef.current.style.cursor = 'grabbing'
  }

  function handleMouseMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    const vp = vpRef.current
    if (vp) applyViewport(clamp({ ...vp, panX: vp.panX + dx, panY: vp.panY + dy }))
  }

  function stopDrag(e) {
    if (!dragMoved.current && dragging.current && e) {
      const rect = wrapRef.current.getBoundingClientRect()
      pickIndividual(e.clientX - rect.left, e.clientY - rect.top)
    }
    dragging.current = false
    if (wrapRef.current) wrapRef.current.style.cursor = ''
  }

  function handleKeyDown(e) {
    const { width: w, height: h } = sizeRef.current
    const vp = vpRef.current; if (!vp) return
    const STEP = 60
    let next = { ...vp }
    switch (e.key) {
      case 'ArrowLeft':  next.panX += STEP; break
      case 'ArrowRight': next.panX -= STEP; break
      case 'ArrowUp':    next.panY += STEP; break
      case 'ArrowDown':  next.panY -= STEP; break
      case '+': case '=': zoomAt(w / 2, h / 2, 1.2); return
      case '-':           zoomAt(w / 2, h / 2, 1 / 1.2); return
      case '0': applyViewport(fitViewport(w, h)); return
      default: return
    }
    e.preventDefault()
    applyViewport(clamp(next))
  }

  // ── render ────────────────────────────────────────────────────────

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
      <canvas ref={spriteCanvasRef} className="island-sprite-canvas" />
      <div className="island-pixel-grid" />

      {selectedInd && (() => {
        const sp   = SPECIES.find(s => s.id === selectedInd.speciesId)
        const dna  = dnaOverridesRef.current[selectedInd.speciesId] ?? sp?.dna ?? []
        const base = sp ? applyDNA(sp.stats, dna) : {}
        const pool = individualsRef.current[selectedInd.speciesId] ?? []
        const ind  = pool.find(i => i.id === selectedInd.indId)
        const idx  = pool.findIndex(i => i.id === selectedInd.indId)
        return sp && ind ? (
          <IndividualCard
            species={sp}
            individual={ind}
            resolvedBase={base}
            idx={idx}
            cssX={selectedInd.cssX}
            cssY={selectedInd.cssY}
            onClose={() => setSelectedInd(null)}
          />
        ) : null
      })()}

      <div
        className="island-hotspots"
        ref={hotspotRef}
        style={{ transformOrigin: '0 0', width: WORLD_W, height: WORLD_H }}
      >
        {hotspots.map(sp => (
          <button
            key={sp.id}
            className="island-hotspot"
            style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }}
            title={sp.label}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onSelectSpecies(sp)}
          >
            <span className="island-hotspot__label">{sp.label}</span>
          </button>
        ))}
      </div>

      <div className="island-zoom-controls">
        <button className="island-zoom-btn" onMouseDown={e => e.stopPropagation()}
          onClick={() => { const { width: w, height: h } = sizeRef.current; zoomAt(w / 2, h / 2, 1.25) }}
          title="Zoom in">+</button>
        <button className="island-zoom-btn" onMouseDown={e => e.stopPropagation()}
          onClick={() => { const { width: w, height: h } = sizeRef.current; applyViewport(fitViewport(w, h)) }}
          title="Reset view">⌂</button>
        <button className="island-zoom-btn" onMouseDown={e => e.stopPropagation()}
          onClick={() => { const { width: w, height: h } = sizeRef.current; zoomAt(w / 2, h / 2, 1 / 1.25) }}
          title="Zoom out">−</button>
      </div>

      <div className="island-hint">
        scroll to zoom · drag to pan · click individual to inspect · ←↑↓→ · +/− · 0 reset
      </div>
    </div>
  )
}
