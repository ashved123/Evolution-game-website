import { BIOMES } from '../data/biomes.js'
import { ISLAND_PRESETS } from '../data/presets.js'

// 36-point polar outline (10° intervals) — shared by all presets
export const SPEC = [
  [  0, 1.00], [ 10, 0.90], [ 20, 0.80], [ 30, 0.70], [ 40, 0.63],
  [ 50, 0.70], [ 60, 0.80], [ 70, 0.92], [ 80, 1.04], [ 90, 1.10],
  [100, 1.18], [110, 1.24], [120, 1.22], [130, 1.16], [140, 1.08],
  [150, 1.00], [160, 0.92], [170, 0.87], [180, 0.88], [190, 0.95],
  [200, 1.02], [210, 1.07], [220, 1.10], [230, 0.97], [240, 0.87],
  [250, 0.97], [260, 1.08], [270, 1.16], [280, 1.06], [290, 0.88],
  [300, 0.80], [310, 0.77], [320, 0.82], [330, 0.90], [340, 0.96],
  [350, 1.00],
]

const cache = new Map()

// Render a preset to an offscreen canvas and return it.
// size: pixel dimensions of the square canvas (default 400).
export function buildIslandBitmap(presetId = 'standard', size = 400) {
  const key = `${presetId}-${size}`
  if (cache.has(key)) return cache.get(key)

  const preset = ISLAND_PRESETS[presetId] ?? ISLAND_PRESETS.standard
  const off    = document.createElement('canvas')
  off.width    = size
  off.height   = size
  const oc     = off.getContext('2d')

  const cx = size * 0.50
  const cy = size * 0.52
  const Rx = size * 0.23
  const Ry = size * 0.21

  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }

  function toPt([deg, r], sx, sy = sx) {
    const rad = (deg * Math.PI) / 180
    return { x: cx + Math.cos(rad) * Rx * r * sx, y: cy + Math.sin(rad) * Ry * r * sy }
  }

  function polarPts(sx, sy = sx) { return SPEC.map(p => toPt(p, sx, sy)) }

  function smoothFill(pts, color) {
    const n = pts.length
    const s = mid(pts[n - 1], pts[0])
    oc.beginPath()
    oc.moveTo(s.x, s.y)
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n])
      oc.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y)
    }
    oc.closePath()
    oc.fillStyle = color
    oc.fill()
  }

  // 1. Deep ocean
  oc.fillStyle = BIOMES.DEEP_OCEAN.color
  oc.fillRect(0, 0, size, size)

  // 2. Shallow water
  smoothFill(polarPts(preset.shallow, preset.shallow * (1.52 / 1.55)), BIOMES.SHALLOW_WATER.color)

  // 3. Beach
  smoothFill(polarPts(preset.beach, preset.beach * (1.16 / 1.18)), BIOMES.BEACH.color)

  // 4. Grassland base
  smoothFill(polarPts(1.00), BIOMES.GRASSLAND.color)

  // 5. Wetland coastal strip (if preset defines one)
  if (preset.wetlandArc) {
    const [startDeg, endDeg] = preset.wetlandArc
    const arc     = SPEC.filter(([deg]) => deg >= startDeg && deg <= endDeg)
    const outer   = arc.map(p => toPt(p, 1.00))
    const inner   = [...arc].reverse().map(p => toPt(p, preset.forest * 0.94))
    oc.beginPath()
    oc.moveTo(outer[0].x, outer[0].y)
    outer.forEach(p => oc.lineTo(p.x, p.y))
    inner.forEach(p => oc.lineTo(p.x, p.y))
    oc.closePath()
    oc.fillStyle = BIOMES.WETLAND.color
    oc.fill()
  }

  // 6. Forest
  smoothFill(polarPts(preset.forest), BIOMES.FOREST.color)

  // 7. Highland
  smoothFill(polarPts(preset.highland), BIOMES.HIGHLAND.color)

  // 8. Rocky peaks
  smoothFill(polarPts(preset.rocky), BIOMES.ROCKY_PEAK.color)

  cache.set(key, off)
  return off
}

export function clearBitmapCache() { cache.clear() }
