import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import './IslandCanvas.css'
import { SPECIES } from '../data/species.js'
import { applyDNA } from '../data/codons.js'
import { freshId, sexualOffspring, getSeason } from '../simulation/individuals.js'
import {
  AWARENESS, HUNGER_RATE, HUNGER_GAIN, EAT_DISTANCE,
  MATE_DISTANCE, BREED_COOLDOWN, LIFESPAN, PREY_OF, PREDATORS_OF, effectiveRadius,
  TREE_ADULT_AGE, TREE_SEED_RADIUS_BASE, TREE_SEED_DROP_CHANCE, TREE_MIN_DISTANCE, TREE_BIOME_GERMINATION,
  CARRYING_CAPACITY, FOOD_K_FACTOR, SEASON_K_FACTOR,
  FROG_WATER_BIOMES, FROG_DESICCATION_DRAIN,
} from '../simulation/agentConfig.js'
import { ISLAND_SCALE } from '../simulation/worldConfig.js'
import IndividualCard from './IndividualCard.jsx'

// ── asset imports ────────────────────────────────────────────────────

import islandVisualSrc  from '../assets/biomes/island_visual_hires.png'
import wetlandVisualSrc from '../assets/biomes/wetland_visual_hires.png'
import islandMaskSrc    from '../assets/biomes/island_biome_mask.png'
import wetlandMaskSrc   from '../assets/biomes/wetland_biome_mask.png'

import beetleAdultPng    from '../assets/sprites/adult/beetle.png'
import beetleJuvPng      from '../assets/sprites/juvenile/beetle_baby.png'
import deerMalePng       from '../assets/sprites/adult/deer_male_adult.png'
import deerFemalePng     from '../assets/sprites/adult/deer_female_adult.png'
import deerFawnPng       from '../assets/sprites/juvenile/deer_fawn.png'
import deerFawnAltPng    from '../assets/sprites/juvenile/deer_fawn_alt.png'
import frogAdultPng      from '../assets/sprites/adult/frog.png'
import hawkAdultPng      from '../assets/sprites/adult/hawk_adult.png'
import boarAdultPng      from '../assets/sprites/adult/boar_adult.png'
import monitorAdultPng   from '../assets/sprites/adult/monitor_adult.png'

import hawkJuvPng        from '../assets/sprites/juvenile/hawk_juvenile.png'
import boarJuvPng        from '../assets/sprites/juvenile/boar_juvenile.png'
import monitorJuvPng     from '../assets/sprites/juvenile/monitor_juvenile.png'
import grassSpritePng    from '../assets/sprites/flora/grass_clump.png'
import figTreePng        from '../assets/sprites/flora/fig_tree.png'
import treeSaplingPng    from '../assets/sprites/flora/tree_sapling.png'
import mangroveAdultPng  from '../assets/sprites/flora/mangrove_wetland.png'
import mangroveSaplingPng from '../assets/sprites/flora/mangrove_sapling.png'
import mushroomPng       from '../assets/sprites/flora/mushroom.png'

// ── constants ────────────────────────────────────────────────────────

// Base PNG dimensions (do not change — these are the actual image pixel sizes)
// ISLAND_SCALE is imported from worldConfig.js — change it there to resize the world.
const BASE_ISLAND_W = 820
const BASE_ISLAND_H = 540

// Two separate land masses: main island (left) + wetland island (top-right, smaller, with gap)
const ISLAND_W   = BASE_ISLAND_W * ISLAND_SCALE
const ISLAND_H   = BASE_ISLAND_H * ISLAND_SCALE
const WETLAND_DW = Math.round(ISLAND_W * 0.52)   // wetland draw width  (~52% of island)
const WETLAND_DH = Math.round(ISLAND_H * 0.52)   // wetland draw height (~52% of island)
const WETLAND_GAP = -Math.round(WETLAND_DW * 0.99) // pull left to cancel PNG ocean padding
const WETLAND_X  = ISLAND_W + WETLAND_GAP         // wetland left edge in world coords
const WETLAND_Y  = -Math.round(WETLAND_DH * 0.26) // shift up to cancel PNG top padding
const WORLD_W    = ISLAND_W + WETLAND_GAP + WETLAND_DW
const WORLD_H    = ISLAND_H

const MIN_SCALE      = 0.02
const MAX_SCALE      = 16.0
const ZOOM_THRESHOLD = 3.0
const SPRITE_SCALE   = 0.04
const SPRITE_SCALE_OVERRIDE = { tree: 0.12, grass: 0.05, monitor: 0.055, boar: 0.045 }
const MAX_SPEED      = 6      // world units per frame at speed stat = 100
// IBM time-scale per slider position (matches SPEED_CONFIG in useSimulation.js)
const SPEED_MULT = [0, 0.3, 1.0, 4.0, 12.0]

// Deer herd behaviour
const HERD_BOND_COUNT    = 2
const HERD_COHESION_MIN  = 50  * ISLAND_SCALE
const HERD_COHESION_MAX  = 200 * ISLAND_SCALE

// Plants don't move — only animals do.
const STATIONARY_SPECIES = new Set(['grass', 'tree', 'fungi'])

// Which biomes each species actively prefers to live in.
const SPECIES_BIOME_PREF = {
  grass:   ['plains', 'marsh', 'highland'],
  tree:    ['forest', 'dense_veg'],
  beetle:  ['plains', 'forest', 'highland', 'mountain', 'marsh'],
  deer:    ['plains', 'forest', 'highland', 'marsh'],
  frog:    ['pond', 'wetland_water', 'marsh', 'plains'],
  hawk:    ['highland', 'mountain', 'forest', 'dense_veg'],
  fungi:   ['forest', 'dense_veg', 'highland', 'marsh'],
  boar:    ['plains', 'forest', 'highland', 'marsh'],
  monitor: ['marsh', 'wetland_water', 'dense_veg', 'plains'],
}

// Biomes that are hard water — animals steer strongly away
const DEEPLY_IMPASSABLE = new Set(['ocean', 'deep_ocean', 'outside'])

// Biomes where trees cannot grow (rocky/barren surfaces)
const TREE_BLOCKED = new Set(['ocean', 'deep_ocean', 'outside', 'mountain', 'beach', 'mud'])

const SPECIES_PIXEL_COLOR = {
  grass: '#b5f542', tree: '#1de08a', beetle: '#c46200',
  deer: '#f5d142', frog: '#00e5ff', hawk: '#ff4081', fungi: '#e040fb',
  boar: '#d4813a', monitor: '#5cad4a',
}

// Scatter offsets for initial position seeding
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

// Spawn scatter radius per species (world units) — scales with ISLAND_SCALE
const DOT_RADIUS = {
  grass:   130 * ISLAND_SCALE,
  tree:     60 * ISLAND_SCALE,
  beetle:   70 * ISLAND_SCALE,
  deer:     90 * ISLAND_SCALE,
  frog:     70 * ISLAND_SCALE,
  hawk:     80 * ISLAND_SCALE,
  fungi:    60 * ISLAND_SCALE,
  boar:     80 * ISLAND_SCALE,
  monitor:  70 * ISLAND_SCALE,
}

const STAT_KEYS = ['speed', 'resilience', 'metabolism', 'camouflage', 'heatTolerance', 'strength']

// ── biome color tables ───────────────────────────────────────────────

const ISLAND_BIOME_PALETTE = [
  { id: 'ocean',    rgb: [109, 220, 240] },
  { id: 'forest',   rgb: [0,   100,   0] },
  { id: 'plains',   rgb: [100, 200,  60] },
  { id: 'highland', rgb: [80,  130,  50] },
  { id: 'mountain', rgb: [100, 100, 100] },
  { id: 'pond',     rgb: [0,   150, 200] },
  { id: 'beach',    rgb: [240, 200, 120] },
  { id: 'outside',  rgb: [0,     0,   0] },
]

const WETLAND_BIOME_PALETTE = [
  { id: 'deep_ocean',    rgb: [15,  100, 160] },
  { id: 'wetland_water', rgb: [0,   210, 230] },
  { id: 'marsh',         rgb: [70,  150,  45] },
  { id: 'dense_veg',     rgb: [25,   85,  25] },
  { id: 'mud',           rgb: [115,  85,  40] },
  { id: 'outside',       rgb: [0,     0,   0] },
]

function nearestBiome(palette, r, g, b) {
  let minDist = Infinity, best = palette[0].id
  for (const { id, rgb } of palette) {
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2
    if (d < minDist) { minDist = d; best = id }
  }
  return best
}

// Builds a biomeAt(wx, wy) function from loaded PNG mask data.
// Wetland is an inset in the top-right corner — checked first so it overrides the island layer.
function buildBiomeAt(islandData, islandW, islandH, wetlandData, wetlandW, wetlandH) {
  function sampleMask(data, w, h, px, py) {
    const x = Math.max(0, Math.min(w - 1, Math.round(px)))
    const y = Math.max(0, Math.min(h - 1, Math.round(py)))
    const i = (y * w + x) * 4
    return [data.data[i], data.data[i + 1], data.data[i + 2]]
  }

  return function biomeAt(wx, wy) {
    // Wetland inset takes priority (top-right corner)
    if (wx >= WETLAND_X && wx < WETLAND_X + WETLAND_DW &&
        wy >= WETLAND_Y && wy < WETLAND_Y + WETLAND_DH) {
      const px = (wx - WETLAND_X) / WETLAND_DW * wetlandW
      const py = (wy - WETLAND_Y) / WETLAND_DH * wetlandH
      const [r, g, b] = sampleMask(wetlandData, wetlandW, wetlandH, px, py)
      return nearestBiome(WETLAND_BIOME_PALETTE, r, g, b)
    }
    // Island base layer
    if (wx >= 0 && wx < ISLAND_W && wy >= 0 && wy < ISLAND_H) {
      const [r, g, b] = sampleMask(islandData, islandW, islandH, wx / ISLAND_SCALE, wy / ISLAND_SCALE)
      return nearestBiome(ISLAND_BIOME_PALETTE, r, g, b)
    }
    return 'outside'
  }
}

// ── visual layer images ──────────────────────────────────────────────

const islandVisualImg  = new Image(); islandVisualImg.src  = islandVisualSrc
const wetlandVisualImg = new Image(); wetlandVisualImg.src = wetlandVisualSrc

function drawMaps(ctx) {
  ctx.fillStyle = '#6ddcf0'
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  ctx.imageSmoothingEnabled = true
  if (islandVisualImg.complete && islandVisualImg.naturalWidth)
    ctx.drawImage(islandVisualImg, 0, 0, ISLAND_W, ISLAND_H)
  if (wetlandVisualImg.complete && wetlandVisualImg.naturalWidth)
    ctx.drawImage(wetlandVisualImg, WETLAND_X, WETLAND_Y, WETLAND_DW, WETLAND_DH)
}

// ── sprite images ────────────────────────────────────────────────────

function makeImg(src) { const img = new Image(); img.src = src; return img }

const SPRITES = {
  grass:  { adult: makeImg(grassSpritePng) },
  tree: {
    adult:       makeImg(figTreePng),
    juv:         makeImg(treeSaplingPng),
    mangrove:    makeImg(mangroveAdultPng),
    mangroveJuv: makeImg(mangroveSaplingPng),
  },
  fungi:   { adult: makeImg(mushroomPng) },
  beetle:  { adult: makeImg(beetleAdultPng),  juv: makeImg(beetleJuvPng)   },
  deer:    { male: makeImg(deerMalePng), female: makeImg(deerFemalePng), juv: makeImg(deerFawnPng), juvAlt: makeImg(deerFawnAltPng) }, // juv=male fawn, juvAlt=female fawn
  frog:    { adult: makeImg(frogAdultPng) },
  hawk:    { adult: makeImg(hawkAdultPng),    juv: makeImg(hawkJuvPng)     },
  boar:    { adult: makeImg(boarAdultPng),    juv: makeImg(boarJuvPng)     },
  monitor: { adult: makeImg(monitorAdultPng), juv: makeImg(monitorJuvPng)  },
}

function getSpriteImg(pos) {
  const sp = SPRITES[pos.spId]
  if (!sp) return null
  if (pos.spId === 'tree') {
    const inWetland = pos.x >= WETLAND_X && pos.x < WETLAND_X + WETLAND_DW &&
                      pos.y >= WETLAND_Y && pos.y < WETLAND_Y + WETLAND_DH
    const isAdult   = (pos.age ?? 0) >= TREE_ADULT_AGE
    if (inWetland) return isAdult ? sp.mangrove : sp.mangroveJuv
    return isAdult ? sp.adult : sp.juv
  }
  if (pos.spId === 'deer') {
    if (pos.age < (LIFESPAN.deer ?? Infinity) * 0.2)
      return pos.gender === 'F' ? sp.juvAlt : sp.juv
    return pos.gender === 'F' ? sp.female : sp.male
  }
  if (sp.juv && pos.age < (LIFESPAN[pos.spId] ?? Infinity) * 0.2) return sp.juv
  return sp.adult
}

function allSpriteImgs() {
  const imgs = [islandVisualImg, wetlandVisualImg]
  for (const sp of Object.values(SPRITES)) {
    for (const img of Object.values(sp)) imgs.push(img)
  }
  return imgs
}

// ── fixed hotspot positions ──────────────────────────────────────────

// Positions as fractions of WORLD_W/WORLD_H
// Hotspot coords expressed as fractions of the BASE PNG dimensions so they scale
// correctly with ISLAND_SCALE (multiply by WORLD_W/WORLD_H to get world coords).
// Island species x: (base_coord * ISLAND_SCALE) / WORLD_W  — correct when WORLD_W > ISLAND_W
// Wetland species: expressed as world-coord fractions of WORLD_W / WORLD_H
const _IX = ISLAND_W / WORLD_W  // island x scale factor
const HOTSPOTS = [
  { id: 'grass',   emoji: '🌿', label: 'Island Grass',   x: (580 / BASE_ISLAND_W) * _IX, y: 410 / BASE_ISLAND_H, color: '#4caf50' },
  { id: 'tree',    emoji: '🌳', label: 'Island Fig',     x: (220 / BASE_ISLAND_W) * _IX, y: 210 / BASE_ISLAND_H, color: '#2e7d32' },
  { id: 'beetle',  emoji: '🪲', label: 'Rock Beetle',    x: (390 / BASE_ISLAND_W) * _IX, y: 155 / BASE_ISLAND_H, color: '#8d6e63' },
  { id: 'deer',    emoji: '🦌', label: 'Leaf Deer',      x: (570 / BASE_ISLAND_W) * _IX, y: 395 / BASE_ISLAND_H, color: '#a5d6a7' },
  { id: 'hawk',    emoji: '🦅', label: 'Island Hawk',    x: (365 / BASE_ISLAND_W) * _IX, y: 110 / BASE_ISLAND_H, color: '#ff7043' },
  { id: 'fungi',   emoji: '🍄', label: 'Shelf Fungi',    x: (200 / BASE_ISLAND_W) * _IX, y: 300 / BASE_ISLAND_H, color: '#ce93d8' },
  { id: 'boar',    emoji: '🐗', label: 'Wild Boar',      x: (500 / BASE_ISLAND_W) * _IX, y: 350 / BASE_ISLAND_H, color: '#d4813a' },
  // Wetland species — positioned within the separate wetland island
  { id: 'frog',    emoji: '🐸', label: 'Marsh Frog',     x: (WETLAND_X + WETLAND_DW * 0.45) / WORLD_W, y: (WETLAND_DH * 0.55) / WORLD_H, color: '#66bb6a' },
  { id: 'monitor', emoji: '🦎', label: 'Monitor Lizard', x: (WETLAND_X + WETLAND_DW * 0.65) / WORLD_W, y: (WETLAND_DH * 0.25) / WORLD_H, color: '#5cad4a' },
]

// ── geometry helpers ─────────────────────────────────────────────────

// Check whether point (tx,ty) is inside a forward cone from (ox,oy) facing `facing` radians.
function inCone(ox, oy, facing, halfAngle, radius, tx, ty) {
  const dx = tx - ox, dy = ty - oy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > radius) return false
  let diff = Math.abs(Math.atan2(dy, dx) - facing) % (Math.PI * 2)
  if (diff > Math.PI) diff = Math.PI * 2 - diff
  return diff <= halfAngle
}

function fitViewport(w, h) {
  const s = Math.min(w / WORLD_W, h / WORLD_H) * 0.92
  return { scale: s, panX: (w - WORLD_W * s) / 2, panY: (h - WORLD_H * s) / 2 }
}

// ── Desirability sampler ──────────────────────────────────────────────
// Samples N evenly-spaced directions inside the awareness zone and scores each one.
// Returns the angle (radians) of the most desirable direction.
// `effReasoning` (0–100) controls noise: low reasoning = nearly random walk;
// high reasoning = reliably picks the best-scored direction.

const N_RAYS = 6
const MAX_SCAN = 20   // max agents checked per prey/predator species per ray

function sampleBestDirection(pos, posMap, bySpecies, biomeAt, spId, base, prefs, effReasoning, resolvedBases) {
  const aw        = AWARENESS[spId]
  const effSpeed  = Math.min(100, Math.max(0, (base.speed ?? 50) + (pos.variation?.speed ?? 0)))
  const range     = effectiveRadius(aw?.radius ?? 300, effSpeed)
  const isCone    = aw?.type === 'cone'
  const facing    = Math.atan2(pos.vy || 0, pos.vx || 0.001)
  const halfAngle = aw?.halfAngle ?? Math.PI
  const checkR    = range * 0.55   // look just over half-range ahead

  let bestScore = -Infinity
  let bestAngle = facing

  for (let i = 0; i < N_RAYS; i++) {
    const t     = i / N_RAYS
    const angle = isCone
      ? facing + (t * 2 - 1) * halfAngle
      : t * Math.PI * 2

    const tx = pos.x + Math.cos(angle) * checkR
    const ty = pos.y + Math.sin(angle) * checkR
    let score = 0

    // ── Biome desirability ───────────────────────────────────────
    const biome = biomeAt ? biomeAt(tx, ty) : 'plains'
    if (DEEPLY_IMPASSABLE.has(biome)) {
      score -= 500
    } else if (spId !== 'frog' && (biome === 'pond' || biome === 'wetland_water')) {
      score -= 250
    } else if (prefs.includes(biome)) {
      score += 60
    }

    // ── Food desirability (scales with hunger) ───────────────────
    const hungerDrive = Math.max(0, (100 - pos.hunger) / 100)
    for (const preySpId of (PREY_OF[spId] ?? [])) {
      const pool = bySpecies[preySpId] ?? []; let n = 0
      // Camouflage reduces how detectable this prey species is (0.5×–1.0× score)
      const preyBase  = resolvedBases?.[preySpId] ?? {}
      const camoDamp  = 1 - (preyBase.camouflage ?? 0) / 200
      for (const [, pe] of pool) {
        if (n++ >= MAX_SCAN) break
        const d = Math.sqrt((pe.x - tx) ** 2 + (pe.y - ty) ** 2)
        if (d < range * 0.8) score += 100 * hungerDrive * (1 - d / (range * 0.8)) * camoDamp
      }
    }

    // ── Predator avoidance ───────────────────────────────────────
    for (const predSpId of (PREDATORS_OF[spId] ?? [])) {
      const pool = bySpecies[predSpId] ?? []; let n = 0
      for (const [, pe] of pool) {
        if (n++ >= MAX_SCAN) break
        const d = Math.sqrt((pe.x - tx) ** 2 + (pe.y - ty) ** 2)
        if (d < range) score -= 200 * (1 - d / range)
      }
    }

    // ── Deer herd cohesion ───────────────────────────────────────
    if (spId === 'deer' && pos.bonds?.length) {
      for (const bondId of pos.bonds) {
        const bp = posMap.get(bondId)
        if (!bp) continue
        const d = Math.sqrt((bp.x - tx) ** 2 + (bp.y - ty) ** 2)
        if (d > HERD_COHESION_MIN && d < HERD_COHESION_MAX) {
          const t2 = (d - HERD_COHESION_MIN) / (HERD_COHESION_MAX - HERD_COHESION_MIN)
          score += 50 * Math.min(1, t2)
        }
      }
    }

    // ── Reasoning noise ──────────────────────────────────────────
    // Low reasoning = large noise = almost random. High reasoning = small noise = optimal.
    score += (Math.random() - 0.5) * (1 - effReasoning / 100) * 320

    if (score > bestScore) { bestScore = score; bestAngle = angle }
  }

  return bestAngle
}

// ── IBM agent loop ────────────────────────────────────────────────────

function stepMovement(posMap, biomeAt, resolvedBases, biomeScoresRef, speedMultiplier, currentTick) {
  if (speedMultiplier === 0) return

  const scores = biomeScoresRef?.current ?? null

  // Build fast lookup: spId → list of [id, entry] for prey/predator scans
  const bySpecies = {}
  for (const [id, entry] of posMap) {
    if (!bySpecies[entry.spId]) bySpecies[entry.spId] = []
    bySpecies[entry.spId].push([id, entry])
  }

  // Compute dynamic effective K once per frame — food availability × season
  const seasonMult = SEASON_K_FACTOR[getSeason(currentTick).name] ?? 1
  const effectiveKMap = {}
  for (const spId of Object.keys(CARRYING_CAPACITY)) {
    const base = CARRYING_CAPACITY[spId]
    const cfg  = FOOD_K_FACTOR[spId]
    let foodRatio = 1
    if (cfg) {
      const foodCount = cfg.food.reduce((sum, p) => sum + (bySpecies[p]?.length ?? 0), 0)
      foodRatio = Math.min(1.5, Math.max(0.15, foodCount / cfg.optimal))
    }
    effectiveKMap[spId] = Math.max(1, Math.round(base * foodRatio * seasonMult))
  }

  const toAdd    = []
  const toRemove = []
  const pendingOffspring = {}   // births queued this frame per species — prevents breed race condition

  for (const [id, pos] of posMap) {
    const spId = pos.spId
    if (!spId || STATIONARY_SPECIES.has(spId)) continue

    const base            = resolvedBases[spId] ?? {}
    const effSpeed        = Math.min(100, Math.max(0, (base.speed        ?? 50) + (pos.variation?.speed        ?? 0)))
    const effStrength     = Math.min(100, Math.max(0, (base.strength     ?? 50) + (pos.variation?.strength     ?? 0)))
    const effConstitution = Math.min(100, Math.max(0, (base.constitution ?? 50) + (pos.variation?.constitution ?? 0)))
    const effMetabolism   = Math.min(100, Math.max(0, (base.metabolism   ?? 50) + (pos.variation?.metabolism   ?? 0)))
    const effFertility    = Math.min(100, Math.max(0, (base.fertility    ?? 50) + (pos.variation?.fertility    ?? 0)))
    const maxSpd          = (effSpeed / 100) * MAX_SPEED

    // ── 1. Age and hunger ────────────────────────────────────────────
    pos.age += speedMultiplier
    const k        = effectiveKMap[spId] ?? Infinity
    const pop      = bySpecies[spId]?.length ?? 0
    const crowding = pop > k * 0.8 ? Math.min(1, (pop / k - 0.8) * 5) : 0
    // Metabolism scales hunger rate: higher metabolism burns energy faster (0.6×–1.4×)
    const metabScale = 0.6 + effMetabolism / 250
    pos.hunger -= (HUNGER_RATE[spId] ?? 0.008) * metabScale * (1 + crowding) * speedMultiplier
    if (pos.cooldowns) {
      for (const ck of Object.keys(pos.cooldowns)) {
        pos.cooldowns[ck] = Math.max(0, pos.cooldowns[ck] - speedMultiplier)
      }
    }

    // ── 2. Death check — lifespan scaled by constitution ────────────
    const lifespan = (LIFESPAN[spId] ?? 72000) * (0.5 + effConstitution / 100)
    if (pos.hunger <= 0 || pos.age >= lifespan) {
      toRemove.push(id)
      continue
    }

    const hs    = HOTSPOTS.find(h => h.id === spId)
    const prefs = SPECIES_BIOME_PREF[spId] ?? []
    const homeX = hs ? hs.x * WORLD_W : WORLD_W / 2
    const homeY = hs ? hs.y * WORLD_H : WORLD_H / 2

    // ── 3. Biome check ───────────────────────────────────────────────
    const biome     = biomeAt ? biomeAt(pos.x, pos.y) : 'plains'
    const inWater   = DEEPLY_IMPASSABLE.has(biome) ||
      (spId !== 'frog' && (biome === 'pond' || biome === 'wetland_water'))
    const inPref    = !inWater && prefs.includes(biome)
    if (scores) {
      if (!scores[spId]) scores[spId] = {}
      scores[spId][id] = inPref
    }

    // Frogs desiccate when away from moist biomes — habitat requirement / limiting factor
    if (spId === 'frog' && !FROG_WATER_BIOMES.has(biome)) {
      pos.hunger -= FROG_DESICCATION_DRAIN * speedMultiplier
    }

    // ── 4. Desirability sampling → choose best direction ────────────
    const effReasoning = Math.min(100, Math.max(0, (base.reasoning ?? 30) + (pos.variation?.reasoning ?? 0)))
    const bestAngle    = sampleBestDirection(pos, posMap, bySpecies, biomeAt, spId, base, prefs, effReasoning, resolvedBases)

    // Force magnitude: faster animals accelerate harder; urgency scales with hunger
    const urgency = 1 + (100 - pos.hunger) / 200   // 1.0–1.5× based on hunger
    const force   = (2 + effSpeed / 25 + effStrength / 50) * urgency
    let ax = Math.cos(bestAngle) * force
    let ay = Math.sin(bestAngle) * force

    // Update display state (used by UI only — does not drive movement)
    const nearPred = (PREDATORS_OF[spId] ?? []).some(predSpId =>
      (bySpecies[predSpId] ?? []).some(([, pe]) => {
        const aw = AWARENESS[spId]
        const r  = effectiveRadius(aw?.radius ?? 300, effSpeed)
        return Math.sqrt((pe.x - pos.x) ** 2 + (pe.y - pos.y) ** 2) < r
      })
    )
    const nearPrey = (PREY_OF[spId] ?? []).some(preySpId =>
      (bySpecies[preySpId] ?? []).some(([, pe]) => {
        const aw = AWARENESS[spId]
        const r  = effectiveRadius(aw?.radius ?? 300, effSpeed)
        return Math.sqrt((pe.x - pos.x) ** 2 + (pe.y - pos.y) ** 2) < r
      })
    )
    pos.state = nearPred ? 'flee' : nearPrey ? 'hunt' : 'wander'

    // ── 5. Eat check — consume any prey within EAT_DISTANCE ─────────
    let justAte = false
    for (const preySpId of (PREY_OF[spId] ?? [])) {
      if (justAte) break
      for (const [pid, pe] of (bySpecies[preySpId] ?? [])) {
        const d = Math.sqrt((pe.x - pos.x) ** 2 + (pe.y - pos.y) ** 2)
        if (d < EAT_DISTANCE) {
          pos.hunger = Math.min(100, pos.hunger + (HUNGER_GAIN[preySpId] ?? 35))
          toRemove.push(pid)
          justAte = true
          break
        }
      }
    }

    // ── 7. Integrate velocity ────────────────────────────────────────
    pos.vx = (pos.vx + ax) * 0.92
    pos.vy = (pos.vy + ay) * 0.92
    const spd = Math.sqrt(pos.vx ** 2 + pos.vy ** 2)
    if (spd > maxSpd) { pos.vx = pos.vx / spd * maxSpd; pos.vy = pos.vy / spd * maxSpd }
    pos.x = Math.max(0, Math.min(WORLD_W, pos.x + pos.vx * speedMultiplier))
    pos.y = Math.max(0, Math.min(WORLD_H, pos.y + pos.vy * speedMultiplier))

    // ── 8. Breeding ──────────────────────────────────────────────────
    const hasGender  = pos.gender !== null
    // Include births already queued this frame so we don't blow past K in a single tick
    const atCapacity = pop + (pendingOffspring[spId] ?? 0) >= k
    if (hasGender && !atCapacity && pos.state !== 'flee' && pos.hunger > 40 && (pos.cooldowns?.breed ?? 0) === 0) {
      const sameSpecies    = bySpecies[spId] ?? []
      const oppositeGender = pos.gender === 'M' ? 'F' : 'M'
      for (const [pid, pentry] of sameSpecies) {
        if (pid === id) continue
        if (pentry.gender !== oppositeGender) continue
        if ((pentry.cooldowns?.breed ?? 0) > 0) continue
        if (pentry.hunger <= 40) continue
        const d = Math.sqrt((pentry.x - pos.x) ** 2 + (pentry.y - pos.y) ** 2)
        if (d < MATE_DISTANCE) {
          const child = sexualOffspring(
            { variation: pos.variation    ?? {} },
            { variation: pentry.variation ?? {} },
          )
          // Mendelian carrier inheritance: each parent mutation has 50% chance of passing
          const childCarriers = new Set()
          for (const mutId of new Set([...(pos.carriers ?? []), ...(pentry.carriers ?? [])])) {
            if (Math.random() < 0.5) childCarriers.add(mutId)
          }
          toAdd.push({
            id: child.id, entry: {
              x: pos.x + (Math.random() - 0.5) * 30 * ISLAND_SCALE,
              y: pos.y + (Math.random() - 0.5) * 30 * ISLAND_SCALE,
              vx: 0, vy: 0,
              spId, gender: child.gender, variation: child.variation,
              carriers: childCarriers,
              state: 'wander', targetId: null,
              hunger: 80, age: 0, cooldowns: { breed: 0 },
            }
          })
          pendingOffspring[spId] = (pendingOffspring[spId] ?? 0) + 1
          // Fertility scales breed cooldown: high fertility = shorter wait (0.5×–1.5×)
          const cooldown = Math.round(BREED_COOLDOWN * (1.5 - effFertility / 100))
          pos.cooldowns.breed    = cooldown
          pentry.cooldowns.breed = cooldown
          break
        }
      }
    }
  }

  // ── Stationary plants: age increment + tree seed dispersal ──────────
  const SEED_STAT_KEYS = ['speed','resilience','metabolism','camouflage','heatTolerance','strength','reasoning','fertility','constitution']
  for (const [, pos] of posMap) {
    if (!STATIONARY_SPECIES.has(pos.spId)) continue
    pos.age = (pos.age ?? 0) + speedMultiplier

    if (pos.spId !== 'tree' || pos.age < TREE_ADULT_AGE) continue

    const base   = resolvedBases['tree'] ?? {}
    const effMet = Math.min(100, Math.max(0, (base.metabolism ?? 38) + (pos.variation?.metabolism ?? 0)))
    const effStr = Math.min(100, Math.max(0, (base.strength   ?? 12) + (pos.variation?.strength   ?? 0)))

    const dropChance = TREE_SEED_DROP_CHANCE * (0.5 + effMet / 200) * speedMultiplier
    if (Math.random() > dropChance) continue

    const seedRadius = TREE_SEED_RADIUS_BASE * (0.5 + effStr / 200)
    const angle = Math.random() * Math.PI * 2
    const dist  = Math.sqrt(Math.random()) * seedRadius
    const sx = pos.x + Math.cos(angle) * dist
    const sy = pos.y + Math.sin(angle) * dist

    const seedBiome = biomeAt ? biomeAt(sx, sy) : 'forest'
    if (TREE_BLOCKED.has(seedBiome)) continue

    // Biome-specific germination: hostile environments suppress sapling establishment
    const germChance = TREE_BIOME_GERMINATION[seedBiome] ?? 0.1
    if (Math.random() > germChance) continue

    // Reject seed position if too close to any existing tree
    let tooClose = false
    for (const [, te] of posMap) {
      if (te.spId !== 'tree') continue
      if (Math.sqrt((sx - te.x) ** 2 + (sy - te.y) ** 2) < TREE_MIN_DISTANCE) { tooClose = true; break }
    }
    if (tooClose) continue

    const variation = {}
    for (const key of SEED_STAT_KEYS) {
      variation[key] = (pos.variation?.[key] ?? 0) + Math.round((Math.random() - 0.5) * 4)
    }
    toAdd.push({ id: freshId(), entry: { x: sx, y: sy, vx: 0, vy: 0, spId: 'tree', variation, age: 0 } })
  }

  for (const rid of toRemove) { if (rid) posMap.delete(rid) }
  for (const { id: nid, entry } of toAdd) posMap.set(nid, entry)
}

// ── drawing ──────────────────────────────────────────────────────────

function drawSpritesFromMap(sprCtx, posMap, highlightMutId) {
  sprCtx.imageSmoothingEnabled = true

  const trees = []

  for (const [, pos] of posMap) {
    if (pos.spId === 'tree') { trees.push(pos); continue }
    const img = getSpriteImg(pos)
    if (!img?.complete || !img.naturalWidth) continue
    const sc = SPRITE_SCALE_OVERRIDE[pos.spId] ?? SPRITE_SCALE
    const w  = img.naturalWidth  * sc
    const h  = img.naturalHeight * sc

    // Highlight ring for mutation carriers
    if (highlightMutId && pos.carriers?.has(highlightMutId)) {
      const cx = pos.x
      const cy = pos.y - h / 2
      const r  = Math.max(w, h) / 2 + 5
      sprCtx.save()
      sprCtx.shadowColor = '#ffee58'
      sprCtx.shadowBlur  = 10
      sprCtx.strokeStyle = '#ffee58'
      sprCtx.lineWidth   = 2.5
      sprCtx.beginPath()
      sprCtx.arc(cx, cy, r, 0, Math.PI * 2)
      sprCtx.stroke()
      sprCtx.restore()
    }

    sprCtx.drawImage(img, pos.x - w / 2, pos.y - h, w, h)
  }

  // Painter's algorithm: sort trees by y so foreground draws on top
  trees.sort((a, b) => a.y - b.y)
  for (const pos of trees) {
    const img = getSpriteImg(pos)
    if (!img?.complete || !img.naturalWidth) continue
    const sc = SPRITE_SCALE_OVERRIDE['tree']
    const w  = img.naturalWidth  * sc
    const h  = img.naturalHeight * sc

    if (highlightMutId && pos.carriers?.has(highlightMutId)) {
      const cx = pos.x
      const cy = pos.y - h / 2
      const r  = Math.max(w, h) / 2 + 5
      sprCtx.save()
      sprCtx.shadowColor = '#ffee58'
      sprCtx.shadowBlur  = 10
      sprCtx.strokeStyle = '#ffee58'
      sprCtx.lineWidth   = 2.5
      sprCtx.beginPath()
      sprCtx.arc(cx, cy, r, 0, Math.PI * 2)
      sprCtx.stroke()
      sprCtx.restore()
    }

    sprCtx.drawImage(img, pos.x - w / 2, pos.y - h, w, h)
  }
}

// ── component ────────────────────────────────────────────────────────

export default function IslandCanvas({
  speed, onSelectSpecies, preset = 'standard', pops = {}, individuals = {},
  dnaOverrides = {}, biomeScoresRef = null, posMapRef = null, popsRef = null, biomeAtRef = null,
  simTickRef = null, highlightMutationId = null, arrivedSpecies = null, spawnMoreTreesRef = null,
  focusViewportRef = null,
}) {
  const canvasRef       = useRef(null)
  const spriteCanvasRef = useRef(null)
  const wrapRef         = useRef(null)
  const hotspotRef      = useRef(null)
  const vpRef           = useRef(null)
  const sizeRef         = useRef({ width: 0, height: 0 })
  const dragging        = useRef(false)
  const dragMoved       = useRef(false)
  const lastMouse       = useRef({ x: 0, y: 0 })
  const wheelHandler    = useRef(null)

  const individualsRef   = useRef(individuals)
  individualsRef.current = individuals
  const dnaOverridesRef  = useRef(dnaOverrides)
  dnaOverridesRef.current = dnaOverrides
  const highlightMutRef  = useRef(highlightMutationId)
  highlightMutRef.current = highlightMutationId
  const speedRef         = useRef(speed)
  speedRef.current       = speed

  const _internalPosRef    = useRef(new Map())
  const positionsRef       = posMapRef ?? _internalPosRef
  const biomeMapRef        = useRef(null)
  const mapCacheRef        = useRef(null)
  const pendingTreeSpawnRef = useRef(0)
  const targetVpRef        = useRef(null)  // { wx, wy, targetScale } — smooth pan target
  const [selectedInd, setSelectedInd] = useState(null)

  // ── Load biome masks (async) ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    function loadMaskData(src) {
      return new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          const off = document.createElement('canvas')
          off.width  = img.naturalWidth
          off.height = img.naturalHeight
          const ctx2 = off.getContext('2d')
          ctx2.drawImage(img, 0, 0)
          resolve({ data: ctx2.getImageData(0, 0, img.naturalWidth, img.naturalHeight), w: img.naturalWidth, h: img.naturalHeight })
        }
        img.onerror = () => resolve(null)
        img.src = src
      })
    }
    Promise.all([loadMaskData(islandMaskSrc), loadMaskData(wetlandMaskSrc)]).then(([imd, wmd]) => {
      if (cancelled || !imd || !wmd) return
      const fn = buildBiomeAt(imd.data, imd.w, imd.h, wmd.data, wmd.w, wmd.h)
      biomeMapRef.current = fn
      if (biomeAtRef) biomeAtRef.current = fn
      // Flush any pending tree spawns that arrived before biome was ready
      if (pendingTreeSpawnRef.current > 0) {
        spawnMoreTreesRef?.current?.(pendingTreeSpawnRef.current)
        pendingTreeSpawnRef.current = 0
      }
    })
    return () => { cancelled = true }
  }, [])

  // Expose spawnMoreTrees(count) for external callers (e.g. tutorial)
  useEffect(() => {
    if (!spawnMoreTreesRef) return
    spawnMoreTreesRef.current = function spawnMoreTrees(count) {
      const fn = biomeMapRef.current
      if (!fn) { pendingTreeSpawnRef.current += count; return }
      const posMap = positionsRef.current
      const treeHotspot = HOTSPOTS.find(h => h.id === 'tree')
      const homeX = treeHotspot ? treeHotspot.x * WORLD_W : 220 * ISLAND_SCALE
      const homeY = treeHotspot ? treeHotspot.y * WORLD_H : 210 * ISLAND_SCALE
      const rad   = (DOT_RADIUS['tree'] ?? 60 * ISLAND_SCALE) * 2.5
      const TREE_PREFERRED = new Set(['forest', 'dense_veg'])
      for (let i = 0; i < count; i++) {
        let placed = false
        // Two passes: first prefer forest/dense_veg, then accept any non-blocked biome
        for (const requireForest of [true, false]) {
          if (placed) break
          for (let attempt = 0; attempt < 80; attempt++) {
            const angle = Math.random() * Math.PI * 2
            const r     = Math.sqrt(Math.random()) * rad
            const x     = homeX + Math.cos(angle) * r
            const y     = homeY + Math.sin(angle) * r
            const biome = fn(x, y)
            if (TREE_BLOCKED.has(biome)) continue
            if (requireForest && !TREE_PREFERRED.has(biome)) continue
            let tooClose = false
            for (const [, e] of posMap) {
              if (e.spId !== 'tree') continue
              if (Math.sqrt((x - e.x) ** 2 + (y - e.y) ** 2) < TREE_MIN_DISTANCE) { tooClose = true; break }
            }
            if (!tooClose) {
              posMap.set(freshId(), { x, y, vx: 0, vy: 0, spId: 'tree', variation: {}, age: TREE_ADULT_AGE })
              placed = true; break
            }
          }
        }
        if (!placed) {
          posMap.set(freshId(), { x: homeX + (Math.random() - 0.5) * rad, y: homeY + (Math.random() - 0.5) * rad, vx: 0, vy: 0, spId: 'tree', variation: {}, age: TREE_ADULT_AGE })
        }
      }
    }
  }, [spawnMoreTreesRef])

  // Expose focusOnTree() — smooth pans + zooms to the first tree in posMap
  useEffect(() => {
    if (!focusViewportRef) return
    focusViewportRef.current = function focusOnTree() {
      const posMap = positionsRef.current
      let wx = null, wy = null
      for (const [, e] of posMap) {
        if (e.spId === 'tree') { wx = e.x; wy = e.y; break }
      }
      if (wx == null) {
        const hs = HOTSPOTS.find(h => h.id === 'tree')
        wx = hs ? hs.x * WORLD_W : 220 * ISLAND_SCALE
        wy = hs ? hs.y * WORLD_H : 210 * ISLAND_SCALE
      }
      targetVpRef.current = { wx, wy, targetScale: 2.2 }
    }
  }, [focusViewportRef])

  // ── Pre-render map to offscreen canvas (one drawImage/frame instead of two huge PNGs) ──
  useEffect(() => {
    const CACHE_W = 1600
    const CACHE_H = Math.round(CACHE_W * WORLD_H / WORLD_W)
    function tryBuild() {
      if (!islandVisualImg.complete || !islandVisualImg.naturalWidth ||
          !wetlandVisualImg.complete || !wetlandVisualImg.naturalWidth) {
        islandVisualImg.onload = wetlandVisualImg.onload = tryBuild
        return
      }
      const off = document.createElement('canvas')
      off.width = CACHE_W; off.height = CACHE_H
      const ctx = off.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.scale(CACHE_W / WORLD_W, CACHE_H / WORLD_H)
      drawMaps(ctx)
      mapCacheRef.current = off
    }
    tryBuild()
  }, [])

  // ── Seed initial animal positions on mount ─────────────────────────
  useEffect(() => {
    const posMap   = positionsRef.current
    const initInds = individualsRef.current

    for (const [spId, pool] of Object.entries(initInds)) {
      if (STATIONARY_SPECIES.has(spId)) continue
      const hs = HOTSPOTS.find(h => h.id === spId)
      if (!hs) continue
      const offsets = SCATTER[spId] ?? []
      const rad     = DOT_RADIUS[spId] ?? 80
      const homeX   = hs.x * WORLD_W
      const homeY   = hs.y * WORLD_H

      for (let i = 0; i < pool.length; i++) {
        const ind = pool[i]
        if (posMap.has(ind.id)) continue
        const off   = offsets[i % offsets.length]
        const angle = off ? off.angle : Math.random() * Math.PI * 2
        const r     = off ? off.r     : Math.sqrt(Math.random())
        posMap.set(ind.id, {
          x: homeX + Math.cos(angle) * r * rad,
          y: homeY + Math.sin(angle) * r * rad,
          vx: 0, vy: 0,
          spId, gender: ind.gender ?? null, variation: ind.variation ?? {},
          state: 'wander', targetId: null,
          hunger: 100, age: 0, cooldowns: { breed: 0 },
        })
      }

      if (spId === 'deer' && pool.length > 1) {
        for (const ind of pool) {
          const pos = posMap.get(ind.id)
          if (!pos || pos.bonds) continue
          const others   = pool.filter(d => d.id !== ind.id)
          const shuffled = others.slice().sort(() => Math.random() - 0.5)
          pos.bonds = shuffled.slice(0, Math.min(HERD_BOND_COUNT, others.length)).map(d => d.id)
        }
      }
    }
  }, [])

  // ── Viewport: update pan/zoom state ──────────────────────────────
  const applyViewport = useCallback((vp) => {
    vpRef.current = vp
    if (hotspotRef.current) {
      hotspotRef.current.style.transform =
        `translate(${vp.panX}px,${vp.panY}px) scale(${vp.scale})`
    }
  }, [])

  // ── RAF animation loop ─────────────────────────────────────────────
  useEffect(() => {
    let rafId
    function frame() {
      const vp      = vpRef.current
      const canvas  = canvasRef.current
      const posMap  = positionsRef.current
      const biomeAt = biomeMapRef.current

      // Smooth pan/zoom toward tutorial focus target
      if (vp && targetVpRef.current) {
        const { wx, wy, targetScale } = targetVpRef.current
        const { width, height } = sizeRef.current
        const goalPanX = width  / 2 - wx * targetScale
        const goalPanY = height / 2 - wy * targetScale
        const a = 0.075
        const lerp = (a_, b) => a_ + (b - a_) * a
        const next = { scale: lerp(vp.scale, targetScale), panX: lerp(vp.panX, goalPanX), panY: lerp(vp.panY, goalPanY) }
        const done = Math.abs(next.scale - targetScale) < 0.003 && Math.abs(next.panX - goalPanX) < 1
        applyViewport(done ? { scale: targetScale, panX: goalPanX, panY: goalPanY } : next)
        if (done) targetVpRef.current = null
      }

      if (vp && canvas) {
        const resolvedBases = {}
        for (const sp of SPECIES) {
          const dna = dnaOverridesRef.current[sp.id] ?? sp.dna
          resolvedBases[sp.id] = applyDNA(sp.stats, dna)
        }

        const spMult = SPEED_MULT[speedRef.current] ?? 0
        stepMovement(posMap, biomeAt ?? (() => 'plains'), resolvedBases, biomeScoresRef, spMult, simTickRef?.current ?? 0)

        if (popsRef) {
          const counts = {}
          for (const [, e] of posMap) {
            if (e.spId) counts[e.spId] = (counts[e.spId] ?? 0) + 1
          }
          popsRef.current = counts
        }

        const ctx = canvas.getContext('2d')
        const { width, height } = sizeRef.current
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, width, height)
        const mapCache = mapCacheRef.current
        if (mapCache) {
          ctx.drawImage(mapCache, vp.panX, vp.panY, WORLD_W * vp.scale, WORLD_H * vp.scale)
        } else {
          ctx.save()
          ctx.translate(vp.panX, vp.panY)
          ctx.scale(vp.scale, vp.scale)
          drawMaps(ctx)
          ctx.restore()
        }

        const spriteCanvas = spriteCanvasRef.current
        if (spriteCanvas) {
          const dpr    = window.devicePixelRatio || 1
          const sprCtx = spriteCanvas.getContext('2d')
          sprCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height)
          sprCtx.save()
          sprCtx.setTransform(vp.scale * dpr, 0, 0, vp.scale * dpr, vp.panX * dpr, vp.panY * dpr)
          drawSpritesFromMap(sprCtx, posMap, highlightMutRef.current)
          sprCtx.restore()
        }
      }
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const resize = useCallback(() => {
    const canvas       = canvasRef.current
    const spriteCanvas = spriteCanvasRef.current
    const wrap         = wrapRef.current
    if (!canvas || !wrap) return
    const { width, height } = wrap.getBoundingClientRect()
    sizeRef.current = { width, height }
    canvas.width  = Math.round(width)
    canvas.height = Math.round(height)
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

  // Redraw when any sprite or visual map image loads
  useEffect(() => {
    const handlers = allSpriteImgs()
      .filter(img => !img.complete)
      .map(img => {
        const fn = () => { if (vpRef.current) applyViewport(vpRef.current) }
        img.addEventListener('load', fn)
        return () => img.removeEventListener('load', fn)
      })
    return () => handlers.forEach(off => off())
  }, [applyViewport])

  // ── Viewport helpers ──────────────────────────────────────────────

  function clampVp(vp) {
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
    applyViewport(clampVp({ scale: s, panX: sx - (sx - vp.panX) * r, panY: sy - (sy - vp.panY) * r }))
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
    const PICK_RADIUS = 30
    let best = null, bestDist = Infinity
    for (const [id, pos] of positionsRef.current) {
      if (!pos.spId || STATIONARY_SPECIES.has(pos.spId)) continue
      const dist = Math.sqrt((wx - pos.x) ** 2 + (wy - pos.y) ** 2)
      if (dist < PICK_RADIUS && dist < bestDist) { bestDist = dist; best = { speciesId: pos.spId, indId: id, cssX, cssY } }
    }
    if (best) setSelectedInd(best)
    else setSelectedInd(null)
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return
    dragging.current = true; dragMoved.current = false
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
    if (vp) applyViewport(clampVp({ ...vp, panX: vp.panX + dx, panY: vp.panY + dy }))
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
    applyViewport(clampVp(next))
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

      {selectedInd && (() => {
        const sp    = SPECIES.find(s => s.id === selectedInd.speciesId)
        const dna   = dnaOverridesRef.current[selectedInd.speciesId] ?? sp?.dna ?? []
        const base  = sp ? applyDNA(sp.stats, dna) : {}
        const entry = positionsRef.current.get(selectedInd.indId)
        const ind   = entry ? { id: selectedInd.indId, gender: entry.gender, variation: entry.variation ?? {} } : null
        return sp && ind ? (
          <IndividualCard
            species={sp}
            individual={ind}
            resolvedBase={base}
            idx={0}
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
        {HOTSPOTS.map(sp => (
          <button
            key={sp.id}
            className="island-hotspot"
            style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }}
            title={sp.label}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onSelectSpecies(SPECIES.find(s => s.id === sp.id) ?? sp)}
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
