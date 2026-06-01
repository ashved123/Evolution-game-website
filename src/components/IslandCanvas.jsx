import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import './IslandCanvas.css'
import { SPECIES } from '../data/species.js'
import { applyDNA } from '../data/codons.js'
import { freshId, sexualOffspring, asexualOffspring, getSeason, BREEDING_TICKS } from '../simulation/individuals.js'
import {
  AWARENESS, HUNGER_RATE, HUNGER_GAIN, EAT_DISTANCE,
  MATE_DISTANCE, BREED_COOLDOWN, LIFESPAN, PREY_OF, PREDATORS_OF, effectiveRadius,
  TREE_ADULT_AGE, TREE_SEED_RADIUS_BASE, TREE_SEED_DROP_CHANCE, TREE_MIN_DISTANCE, TREE_BIOME_GERMINATION,
  CARRYING_CAPACITY, FOOD_K_FACTOR, SEASON_K_FACTOR,
  FROG_WATER_BIOMES, FROG_DESICCATION_DRAIN,
  BEETLE_FOREST_BIOMES, BEETLE_FOREST_DRAIN,
  FIREFLY_POND_BIOMES, FIREFLY_DESICCATION_DRAIN,
  FROG_EGG_HATCH_TIME, FROG_TADPOLE_MORPH_AGE, FROG_TADPOLE_DEATH_CHANCE,
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
import fireflyPng        from '../assets/sprites/juvenile/firefly.png'
import frogTadpolePng    from '../assets/sprites/juvenile/frog_tadpole.png'
import frogEggPng        from '../assets/sprites/juvenile/frog_egg.png'

// ── constants ────────────────────────────────────────────────────────

// ── Wetland toggle — set to true to re-enable the second island ─────
// All wetland code and assets are preserved; only rendering and biome
// detection are gated here so it can be unlocked as a progression feature.
const WETLAND_ENABLED = false

// Base PNG dimensions (do not change — these are the actual image pixel sizes)
// ISLAND_SCALE is imported from worldConfig.js — change it there to resize the world.
const BASE_ISLAND_W = 820
const BASE_ISLAND_H = 540

// Two separate land masses: main island (left) + wetland island (top-right, smaller, with gap)
const ISLAND_W    = BASE_ISLAND_W * ISLAND_SCALE
const ISLAND_H    = BASE_ISLAND_H * ISLAND_SCALE
const WETLAND_DW  = Math.round(ISLAND_W * 0.52)
const WETLAND_DH  = Math.round(ISLAND_H * 0.52)
const WETLAND_GAP = -Math.round(WETLAND_DW * 0.99)
const WETLAND_X   = ISLAND_W + WETLAND_GAP
const WETLAND_Y   = -Math.round(WETLAND_DH * 0.26)
// When wetland is disabled, world is just the main island
const WORLD_W     = WETLAND_ENABLED ? ISLAND_W + WETLAND_GAP + WETLAND_DW : ISLAND_W
const WORLD_H     = ISLAND_H

const MIN_SCALE      = 0.02
const MAX_SCALE      = 16.0
const ZOOM_THRESHOLD = 3.0
const SPRITE_SCALE   = 0.04
const SPRITE_SCALE_OVERRIDE = { tree: 0.12, grass: 0.05, monitor: 0.055, boar: 0.045, frog_egg: 0.030, frog_tadpole: 0.032 }
const MAX_SPEED      = 6      // world units per frame at speed stat = 100
// IBM time-scale per speed value 0–11 (matches SPEED_CONFIG in useSimulation.js)
const SPEED_MULT = [0, 0.3, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]

// Deer herd behaviour
const HERD_BOND_COUNT    = 2
const HERD_COHESION_MIN  = 130 * ISLAND_SCALE  // attraction only kicks in beyond this distance
const HERD_COHESION_MAX  = 400 * ISLAND_SCALE  // lose herd interest beyond this
// Minimum personal space before separation force pushes conspecifics apart.
// Juveniles use 25% of this, so they naturally cluster near parents.
const SEPARATION_SPACE   = {
  deer:    58 * ISLAND_SCALE,
  boar:    50 * ISLAND_SCALE,
  frog:    14 * ISLAND_SCALE,  // social near water but shouldn't stack
  monitor: 42 * ISLAND_SCALE,  // solitary ambush predator — wide personal territory
}

// Plants don't move — only animals do.
const STATIONARY_SPECIES = new Set(['grass', 'tree', 'fungi', 'frog_egg'])

// Which biomes each species actively prefers to live in.
const SPECIES_BIOME_PREF = {
  grass:   ['plains', 'marsh', 'highland'],
  tree:    ['forest', 'dense_veg'],
  beetle:  ['forest', 'dense_veg'],
  deer:    ['plains', 'forest', 'highland', 'marsh'],
  frog:    ['pond', 'wetland_water'],
  firefly:      ['pond'],
  frog_egg:     ['pond'],
  frog_tadpole: ['pond'],
  hawk:         ['highland', 'mountain', 'forest', 'dense_veg'],
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
  boar: '#d4813a', monitor: '#5cad4a', firefly: '#c8e832',
  frog_egg: '#ffd0c0', frog_tadpole: '#5a9030',
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
  firefly:      50 * ISLAND_SCALE,
  frog_egg:     30 * ISLAND_SCALE,
  frog_tadpole: 40 * ISLAND_SCALE,
}

const STAT_KEYS = ['speed', 'resilience', 'metabolism', 'camouflage', 'heatTolerance', 'strength']

// ── biome color tables ───────────────────────────────────────────────

const ISLAND_BIOME_PALETTE = [
  { id: 'ocean',    rgb: [20,  120, 180] },
  { id: 'forest',   rgb: [0,   100,   0] },
  { id: 'plains',   rgb: [100, 200,  60] },
  { id: 'highland', rgb: [80,  130,  50] },
  { id: 'mountain', rgb: [100, 100, 100] },
  { id: 'pond',     rgb: [0,   190, 220] },
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
    // Wetland inset (only active when WETLAND_ENABLED)
    if (WETLAND_ENABLED &&
        wx >= WETLAND_X && wx < WETLAND_X + WETLAND_DW &&
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
  if (WETLAND_ENABLED && wetlandVisualImg.complete && wetlandVisualImg.naturalWidth)
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
  firefly:      { adult: makeImg(fireflyPng)     },
  frog_egg:     { adult: makeImg(frogEggPng)     },
  frog_tadpole: { adult: makeImg(frogTadpolePng) },
}

function getSpriteImg(pos) {
  const sp = SPRITES[pos.spId]
  if (!sp) return null
  if (pos.spId === 'tree') {
    const inWetland = WETLAND_ENABLED &&
                      pos.x >= WETLAND_X && pos.x < WETLAND_X + WETLAND_DW &&
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
  // Wetland species — relocated to main island while WETLAND_ENABLED = false
  { id: 'frog',    emoji: '🐸', label: 'Marsh Frog',     x: (360 / BASE_ISLAND_W) * _IX, y: 320 / BASE_ISLAND_H, color: '#66bb6a' },
  { id: 'firefly', emoji: '✨', label: 'Pond Firefly',   x: (355 / BASE_ISLAND_W) * _IX, y: 310 / BASE_ISLAND_H, color: '#c8e832' },
  { id: 'monitor', emoji: '🦎', label: 'Monitor Lizard', x: (550 / BASE_ISLAND_W) * _IX, y: 180 / BASE_ISLAND_H, color: '#5cad4a' },
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
    } else if (spId !== 'frog' && spId !== 'frog_tadpole' && (biome === 'pond' || biome === 'wetland_water')) {
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

function stepMovement(posMap, biomeAt, resolvedBases, biomeScoresRef, speedMultiplier, currentTick, diversityRef, deathLogRef) {
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
  const numTrees   = bySpecies['tree']?.length ?? 0
  const numBoar    = bySpecies['boar']?.length ?? 0

  const effectiveKMap = {}
  for (const spId of Object.keys(CARRYING_CAPACITY)) {
    const base = CARRYING_CAPACITY[spId]
    const cfg  = FOOD_K_FACTOR[spId]
    let foodRatio = 1
    if (cfg) {
      let foodCount = cfg.food.reduce((sum, p) => sum + (bySpecies[p]?.length ?? 0), 0)
      // Deer and boar compete for grass: each boar consumes ~0.4 units of deer-accessible grass
      if (spId === 'deer') foodCount = Math.max(0, foodCount - numBoar * 0.4)
      foodRatio = Math.min(1.5, Math.max(0.15, foodCount / cfg.optimal))
    }
    effectiveKMap[spId] = Math.max(1, Math.round(base * foodRatio * seasonMult))
  }

  // Beetles: hard cap at trees × BEETLES_PER_TREE (each tree supports a limited colony)
  const BEETLES_PER_TREE = 4
  effectiveKMap['beetle'] = Math.max(1, Math.min(
    effectiveKMap['beetle'] ?? CARRYING_CAPACITY['beetle'],
    numTrees * BEETLES_PER_TREE
  ))

  // Precompute how many beetles share each home tree (O(n) once, O(1) per beetle)
  const beetlesPerTree = {}
  for (const [, e] of posMap) {
    if (e.spId === 'beetle' && e.homeTreeId)
      beetlesPerTree[e.homeTreeId] = (beetlesPerTree[e.homeTreeId] ?? 0) + 1
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
    // Abandon courting when starving — survival comes first
    if (pos.mateTargetId && pos.hunger < 40) pos.mateTargetId = null

    // ── 1b. Firefly: spawn one child then die every tick ─────────────
    // Runs before the death check so speed multiplier never skips the spawn.
    if (spId === 'firefly') {
      const ffPop = bySpecies['firefly']?.length ?? 0
      if (ffPop + (pendingOffspring['firefly'] ?? 0) < (effectiveKMap['firefly'] ?? 80)) {
        const child = asexualOffspring({ variation: pos.variation ?? {} })
        const childCarriers = new Set()
        for (const mutId of (pos.carriers ?? [])) { if (Math.random() < 0.5) childCarriers.add(mutId) }
        toAdd.push({ id: child.id, entry: {
          x: pos.x + (Math.random() - 0.5) * 6 * ISLAND_SCALE,
          y: pos.y + (Math.random() - 0.5) * 6 * ISLAND_SCALE,
          vx: 0, vy: 0, spId: 'firefly',
          gender: null, variation: child.variation, carriers: childCarriers,
          state: 'wander', targetId: null,
          hunger: 100, age: 0, cooldowns: {},
        }})
        pendingOffspring['firefly'] = (pendingOffspring['firefly'] ?? 0) + 1
      }
      toRemove.push({ id, spId, cause: 'age' })
      continue
    }

    // ── 2. Death check — lifespan scaled by constitution ────────────
    const lifespan = (LIFESPAN[spId] ?? 72000) * (0.5 + effConstitution / 100)
    // Inbreeding depression: low genetic diversity raises random death chance.
    // diversityIndex 0 = fully inbred (up to +60% death risk), 100 = diverse (no penalty).
    const divIndex   = diversityRef?.current?.[spId] ?? 100
    const inbreedRisk = Math.max(0, (1 - divIndex / 100)) * 0.0006 * speedMultiplier
    if (pos.hunger <= 0 || pos.age >= lifespan || Math.random() < inbreedRisk) {
      const cause = pos.hunger <= 0 ? 'starvation' : pos.age >= lifespan ? 'age' : 'inbreeding'
      toRemove.push({ id, spId, cause })
      continue
    }

    const hs    = HOTSPOTS.find(h => h.id === spId)
    const prefs = SPECIES_BIOME_PREF[spId] ?? []
    const homeX = hs ? hs.x * WORLD_W : WORLD_W / 2
    const homeY = hs ? hs.y * WORLD_H : WORLD_H / 2

    // ── 3. Biome check ───────────────────────────────────────────────
    const biome     = biomeAt ? biomeAt(pos.x, pos.y) : 'plains'
    const inWater   = DEEPLY_IMPASSABLE.has(biome) ||
      (spId !== 'frog' && spId !== 'frog_tadpole' && (biome === 'pond' || biome === 'wetland_water'))
    const inPref    = !inWater && prefs.includes(biome)
    if (scores) {
      if (!scores[spId]) scores[spId] = {}
      scores[spId][id] = inPref
    }

    // Frogs desiccate when away from moist biomes — habitat requirement / limiting factor
    if (spId === 'frog' && !FROG_WATER_BIOMES.has(biome)) {
      pos.hunger -= FROG_DESICCATION_DRAIN * speedMultiplier
    }
    // Beetles starve outside forest canopy — their entire lifecycle depends on tree fruit
    if (spId === 'beetle' && !BEETLE_FOREST_BIOMES.has(biome)) {
      pos.hunger -= BEETLE_FOREST_DRAIN * speedMultiplier
    }
    // Fireflies desiccate rapidly when away from pond biomes
    if (spId === 'firefly' && !FIREFLY_POND_BIOMES.has(biome)) {
      pos.hunger -= FIREFLY_DESICCATION_DRAIN * speedMultiplier
    }
    // Tadpoles die quickly if they leave the pond
    if (spId === 'frog_tadpole' && !FROG_WATER_BIOMES.has(biome)) {
      pos.hunger -= FROG_DESICCATION_DRAIN * 3 * speedMultiplier
    }

    // ── 3c. Tadpole lifecycle — random death + metamorphosis ─────────
    if (spId === 'frog_tadpole') {
      // Most tadpoles die before metamorphosing
      if (Math.random() < FROG_TADPOLE_DEATH_CHANCE * speedMultiplier) {
        toRemove.push({ id, spId, cause: 'age' })
        continue
      }
      // Metamorphose into adult frog
      if (pos.age >= FROG_TADPOLE_MORPH_AGE) {
        toRemove.push({ id, spId, cause: 'age' })
        toAdd.push({ id: freshId(), entry: {
          x: pos.x, y: pos.y, vx: 0, vy: 0, spId: 'frog',
          gender: pos.gender ?? (Math.random() < 0.5 ? 'M' : 'F'),
          variation: pos.variation ?? {},
          carriers: pos.carriers ?? new Set(),
          state: 'wander', targetId: null, mateTargetId: null,
          hunger: 70, age: 0, cooldowns: { breed: 0 },
        }})
        pendingOffspring['frog'] = (pendingOffspring['frog'] ?? 0) + 1
        continue
      }
      // Lazy wiggle in the pond — no hunting or fleeing
      if (!pos.orbitPhase) pos.orbitPhase = Math.random() * Math.PI * 2
      pos.orbitPhase += (0.04 + Math.random() * 0.04) * speedMultiplier
      const drift = (0.3 + effSpeed / 200) * speedMultiplier
      pos.vx = (pos.vx + Math.cos(pos.orbitPhase) * drift) * 0.82
      pos.vy = (pos.vy + Math.sin(pos.orbitPhase) * drift) * 0.82
      pos.x  = Math.max(0, Math.min(WORLD_W, pos.x + pos.vx))
      pos.y  = Math.max(0, Math.min(WORLD_H, pos.y + pos.vy))
      continue  // skip standard IBM
    }

    // Beetles: overcrowding on home tree drains hunger — too many larvae on one tree
    if (spId === 'beetle' && pos.homeTreeId) {
      const share = beetlesPerTree[pos.homeTreeId] ?? 0
      if (share > BEETLES_PER_TREE) {
        const pressure = Math.min(1, (share - BEETLES_PER_TREE) / BEETLES_PER_TREE)
        pos.hunger -= 0.018 * pressure * speedMultiplier
      }
    }

    // ── 3b. Hawk soaring — overrides standard IBM movement ──────────
    // Hawks orbit their nest tree when wandering, dive at prey when locked.
    // They use full deer-style mateTargetId courtship during early-spring only,
    // and chicks hatch at the nest tree.
    if (spId === 'hawk') {
      const effReasoning = Math.min(100, Math.max(0, (base.reasoning ?? 30) + (pos.variation?.reasoning ?? 0)))
      const awarenessR   = effectiveRadius(AWARENESS['hawk']?.radius ?? 300, effSpeed)

      // ── Nest tree management ─────────────────────────────────────
      const trees = bySpecies['tree'] ?? []
      if (pos.homeTreeId && !posMap.has(pos.homeTreeId)) pos.homeTreeId = null
      if (!pos.homeTreeId && trees.length > 0) {
        const preferred = trees.filter(([, te]) => {
          const tb = biomeAt ? biomeAt(te.x, te.y) : 'forest'
          return tb === 'highland' || tb === 'mountain' || tb === 'forest'
        })
        const pool = preferred.length > 0 ? preferred : trees
        let best = null, bestD2 = Infinity
        for (const [tid, te] of pool) {
          const d2 = (te.x - pos.x) ** 2 + (te.y - pos.y) ** 2
          if (d2 < bestD2) { bestD2 = d2; best = tid }
        }
        pos.homeTreeId = best
      }
      const nestTree = pos.homeTreeId ? posMap.get(pos.homeTreeId) : null
      const nestX = nestTree ? nestTree.x : homeX
      const nestY = nestTree ? nestTree.y : homeY

      // Drop stale target
      if (pos.targetId && !posMap.has(pos.targetId)) pos.targetId = null

      // Acquire target
      if (!pos.targetId && pos.hunger < 85) {
        const candidates = []
        for (const preySpId of (PREY_OF['hawk'] ?? [])) {
          for (const [pid, pe] of (bySpecies[preySpId] ?? [])) {
            const d = Math.sqrt((pe.x - pos.x) ** 2 + (pe.y - pos.y) ** 2)
            if (d < awarenessR) candidates.push({ pid, d, gain: HUNGER_GAIN[preySpId] ?? 35 })
          }
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => (b.gain / b.d) - (a.gain / a.d))
          pos.targetId = candidates[0].pid
        }
      }

      let hax = 0, hay = 0
      if (pos.targetId) {
        // Dive: beeline at 2× speed, no noise
        const target = posMap.get(pos.targetId)
        if (target) {
          pos.state = 'hunt'
          const angle = Math.atan2(target.y - pos.y, target.x - pos.x)
          const diveSpeed = maxSpd * 2.2
          hax = Math.cos(angle) * diveSpeed * 0.4
          hay = Math.sin(angle) * diveSpeed * 0.4
        } else {
          pos.targetId = null
        }
      } else {
        // Soar: wide clockwise ellipse around nest tree
        pos.state = 'wander'
        if (!pos.orbitPhase) pos.orbitPhase = Math.random() * Math.PI * 2
        pos.orbitPhase += 0.012 * speedMultiplier
        const orbitR = 220 * ISLAND_SCALE
        const tx = nestX + Math.cos(pos.orbitPhase) * orbitR
        const ty = nestY + Math.sin(pos.orbitPhase) * orbitR * 0.55
        const angle = Math.atan2(ty - pos.y, tx - pos.x)
        hax = Math.cos(angle) * (2 + effSpeed / 30)
        hay = Math.sin(angle) * (2 + effSpeed / 30)
      }

      // Eat check — only on locked target
      if (pos.targetId) {
        const target = posMap.get(pos.targetId)
        if (target) {
          const d = Math.sqrt((target.x - pos.x) ** 2 + (target.y - pos.y) ** 2)
          if (d < EAT_DISTANCE * 2) {
            pos.hunger = Math.min(100, pos.hunger + (HUNGER_GAIN[target.spId] ?? 35))
            toRemove.push({ id: pos.targetId, spId: target.spId, cause: 'predation' })
            pos.targetId = null
          }
        }
      }

      pos.vx = (pos.vx + hax) * 0.88
      pos.vy = (pos.vy + hay) * 0.88
      const hspd = Math.sqrt(pos.vx ** 2 + pos.vy ** 2)
      const hmaxSpd = pos.state === 'hunt' ? maxSpd * 2.2 : maxSpd
      if (hspd > hmaxSpd) { pos.vx = pos.vx / hspd * hmaxSpd; pos.vy = pos.vy / hspd * hmaxSpd }
      pos.x = Math.max(0, Math.min(WORLD_W, pos.x + pos.vx * speedMultiplier))
      pos.y = Math.max(0, Math.min(WORLD_H, pos.y + pos.vy * speedMultiplier))

      // ── Courtship — deer-style mateTargetId, early spring only ──
      const effFertility = Math.min(100, Math.max(0, (base.fertility ?? 50) + (pos.variation?.fertility ?? 0)))
      if (pos.gender !== null && pop + (pendingOffspring['hawk'] ?? 0) < k &&
          pos.hunger > 40 && (pos.cooldowns?.breed ?? 0) === 0) {
        const tickOfYear = ((currentTick % 12) + 12) % 12
        const inSeason   = BREEDING_TICKS['hawk']?.includes(tickOfYear) ?? true

        if (!inSeason) {
          if (pos.mateTargetId) pos.mateTargetId = null
        } else if (pos.mateTargetId) {
          const mate = posMap.get(pos.mateTargetId)
          if (!mate || mate.mateTargetId !== id || (mate.cooldowns?.breed ?? 0) > 0) {
            pos.mateTargetId = null
          } else {
            const d = Math.sqrt((mate.x - pos.x) ** 2 + (mate.y - pos.y) ** 2)
            if (d < MATE_DISTANCE * 3) {
              const child = sexualOffspring({ variation: pos.variation ?? {} }, { variation: mate.variation ?? {} })
              const childCarriers = new Set()
              for (const mutId of new Set([...(pos.carriers ?? []), ...(mate.carriers ?? [])])) {
                if (Math.random() < 0.5) childCarriers.add(mutId)
              }
              const spawnX = nestTree ? nestTree.x + (Math.random() - 0.5) * 10 * ISLAND_SCALE : pos.x
              const spawnY = nestTree ? nestTree.y + (Math.random() - 0.5) * 10 * ISLAND_SCALE : pos.y
              toAdd.push({ id: child.id, entry: {
                x: spawnX, y: spawnY, vx: 0, vy: 0, spId: 'hawk',
                gender: child.gender, variation: child.variation, carriers: childCarriers,
                state: 'wander', targetId: null,
                homeTreeId: null, mateTargetId: null,
                orbitPhase: Math.random() * Math.PI * 2,
                hunger: 80, age: 0, cooldowns: { breed: 0 },
              }})
              pendingOffspring['hawk'] = (pendingOffspring['hawk'] ?? 0) + 1
              const cooldown = Math.round(BREED_COOLDOWN * (1.5 - effFertility / 100))
              pos.cooldowns.breed = cooldown
              mate.cooldowns.breed = cooldown
              pos.mateTargetId = null
              mate.mateTargetId = null
            }
          }
        } else if (pos.gender === 'F') {
          const males = bySpecies['hawk'] ?? []
          let chosenId = null, bestDesirability = -1
          for (const [mid, me] of males) {
            if (me.gender !== 'M') continue
            if ((me.cooldowns?.breed ?? 0) > 0) continue
            if (me.hunger <= 40) continue
            if (me.mateTargetId) continue
            const d = Math.sqrt((me.x - pos.x) ** 2 + (me.y - pos.y) ** 2)
            if (d > awarenessR) continue
            const mSpeed = Math.min(100, Math.max(0, (base.speed ?? 50) + (me.variation?.speed ?? 0)))
            const mStr   = Math.min(100, Math.max(0, (base.strength ?? 50) + (me.variation?.strength ?? 0)))
            const mConst = Math.min(100, Math.max(0, (base.constitution ?? 50) + (me.variation?.constitution ?? 0)))
            const mResil = Math.min(100, Math.max(0, (base.resilience ?? 50) + (me.variation?.resilience ?? 0)))
            const desirability = (mSpeed + mStr + mConst + mResil) / 4
            const threshold = 28 + (effReasoning / 100) * 38
            if (desirability >= threshold && desirability > bestDesirability) {
              bestDesirability = desirability
              chosenId = mid
            }
          }
          if (chosenId !== null) {
            pos.mateTargetId = chosenId
            const chosenMale = posMap.get(chosenId)
            if (chosenMale) chosenMale.mateTargetId = id
          }
        }
      } else if (pos.mateTargetId) {
        pos.mateTargetId = null
      }

      continue  // skip the standard IBM block below
    }

    // ── 4. Reasoning-based target acquisition + direction ───────────
    const effReasoning = Math.min(100, Math.max(0, (base.reasoning ?? 30) + (pos.variation?.reasoning ?? 0)))
    const awarenessR   = effectiveRadius(AWARENESS[spId]?.radius ?? 300, effSpeed)

    // Predator proximity — flee overrides hunt and clears any target
    const fleeing = (PREDATORS_OF[spId] ?? []).some(predSpId =>
      (bySpecies[predSpId] ?? []).some(([, pe]) =>
        Math.sqrt((pe.x - pos.x) ** 2 + (pe.y - pos.y) ** 2) < awarenessR
      )
    )

    if (fleeing) {
      pos.targetId = null
      pos.state = 'flee'
    } else {
      // Drop stale target (prey was eaten by someone else or died)
      if (pos.targetId && !posMap.has(pos.targetId)) pos.targetId = null

      // Acquire a target when hungry and without one
      if (!pos.targetId && pos.hunger < 85) {
        const candidates = []
        for (const preySpId of (PREY_OF[spId] ?? [])) {
          for (const [pid, pe] of (bySpecies[preySpId] ?? [])) {
            const d = Math.sqrt((pe.x - pos.x) ** 2 + (pe.y - pos.y) ** 2)
            if (d < awarenessR) candidates.push({ pid, d, gain: HUNGER_GAIN[preySpId] ?? 35 })
          }
        }
        if (candidates.length > 0) {
          if (Math.random() < effReasoning / 100) {
            // Smart: prefer prey not already targeted by a herd mate (avoid pile-up),
            // then pick best energy-gain-per-distance ratio.
            const contested = new Set(
              (bySpecies[spId] ?? [])
                .filter(([sid]) => sid !== id)
                .map(([, sp]) => sp.targetId)
                .filter(Boolean)
            )
            const pool = candidates.filter(c => !contested.has(c.pid))
            const ranked = (pool.length > 0 ? pool : candidates)
              .sort((a, b) => (b.gain / b.d) - (a.gain / a.d))
            pos.targetId = ranked[0].pid
          } else {
            // Dumb: random visible prey (may pile onto same target as herd mates)
            pos.targetId = candidates[Math.floor(Math.random() * candidates.length)].pid
          }
        }
      }

      pos.state = pos.targetId ? 'hunt' : 'wander'
    }

    // In-water recovery: highest priority — abandon target and beeline to land.
    // Separation is skipped below so it can't push the animal deeper into water.
    let bestAngle
    if (inWater) {
      pos.targetId    = null
      pos.mateTargetId = null
      pos.state        = 'wander'
      bestAngle        = Math.atan2(homeY - pos.y, homeX - pos.x)
    } else if (spId === 'frog' && !FROG_WATER_BIOMES.has(biome) && !pos.targetId) {
      // Frogs idle out of water: return to pond (desiccation handles the rest)
      pos.mateTargetId = null
      pos.state        = 'wander'
      bestAngle        = Math.atan2(homeY - pos.y, homeX - pos.x) + (Math.random() - 0.5) * 0.25
    } else if (!fleeing && pos.targetId) {
      // Food hunting takes priority over courting
      const target = posMap.get(pos.targetId)
      if (target) {
        const directAngle = Math.atan2(target.y - pos.y, target.x - pos.x)
        const noise = (1 - effReasoning / 100) * (Math.random() - 0.5) * Math.PI * 0.7
        bestAngle = directAngle + noise
      } else {
        pos.targetId = null
        bestAngle = sampleBestDirection(pos, posMap, bySpecies, biomeAt, spId, base, prefs, effReasoning, resolvedBases)
      }
    } else if (!fleeing && pos.mateTargetId && pos.hunger > 45) {
      // Pathfind toward accepted mate — both move toward each other
      const mate = posMap.get(pos.mateTargetId)
      if (mate && mate.mateTargetId === id) {
        const directAngle = Math.atan2(mate.y - pos.y, mate.x - pos.x)
        const noise = (1 - effReasoning / 100) * (Math.random() - 0.5) * Math.PI * 0.35
        bestAngle = directAngle + noise
      } else {
        pos.mateTargetId = null
        bestAngle = sampleBestDirection(pos, posMap, bySpecies, biomeAt, spId, base, prefs, effReasoning, resolvedBases)
      }
    } else {
      bestAngle = sampleBestDirection(pos, posMap, bySpecies, biomeAt, spId, base, prefs, effReasoning, resolvedBases)
    }

    // ── Beetle movement: breed-tree first, then home-tree ─────────────
    if (spId === 'beetle' && pos.state === 'wander' && !pos.targetId && !inWater) {
      const trees = bySpecies['tree'] ?? []

      // Drop stale refs
      if (pos.breedTreeId && !posMap.has(pos.breedTreeId)) pos.breedTreeId = null
      if (pos.homeTreeId  && !posMap.has(pos.homeTreeId))  pos.homeTreeId  = null

      // Assign home tree if missing
      if (!pos.homeTreeId) {
        let nearest = null, nearestD2 = Infinity
        for (const [tid, te] of trees) {
          const d2 = (te.x - pos.x) ** 2 + (te.y - pos.y) ** 2
          if (d2 < nearestD2) { nearestD2 = d2; nearest = tid }
        }
        pos.homeTreeId = nearest
      }

      if (pos.breedTreeId) {
        // Moving to lay eggs — beeline toward breed tree
        const bt = posMap.get(pos.breedTreeId)
        if (bt) {
          const noise = (1 - effReasoning / 100) * (Math.random() - 0.5) * Math.PI * 0.3
          bestAngle = Math.atan2(bt.y - pos.y, bt.x - pos.x) + noise
        }
      } else if (pos.homeTreeId) {
        // Return to home tree if far away
        const ht = posMap.get(pos.homeTreeId)
        if (ht) {
          const d = Math.sqrt((ht.x - pos.x) ** 2 + (ht.y - pos.y) ** 2)
          if (d > 6 * ISLAND_SCALE) {
            const noise = (1 - effReasoning / 100) * (Math.random() - 0.5) * Math.PI * 0.35
            bestAngle = Math.atan2(ht.y - pos.y, ht.x - pos.x) + noise
          }
        }
      }
    }

    // Panic urgency in water so the animal escapes quickly; otherwise scale with hunger
    const urgency = inWater ? 2.5 : 1 + (100 - pos.hunger) / 200
    const force   = (2 + effSpeed / 25 + effStrength / 50) * urgency
    let ax = Math.cos(bestAngle) * force
    let ay = Math.sin(bestAngle) * force

    // ── 5. Eat check — only when physically at the locked target ────
    let justAte = false
    if (pos.targetId) {
      const target = posMap.get(pos.targetId)
      if (target) {
        const d = Math.sqrt((target.x - pos.x) ** 2 + (target.y - pos.y) ** 2)
        if (d < EAT_DISTANCE) {
          const preySpId = target.spId
          pos.hunger = Math.min(100, pos.hunger + (HUNGER_GAIN[preySpId] ?? 35))
          if (preySpId !== 'tree') toRemove.push({ id: pos.targetId, spId: preySpId, cause: 'predation' })
          pos.targetId = null
          justAte = true
        }
      }
    }

    // ── 6. Separation — prevents conspecific piling ──────────────────
    const sepSpace = SEPARATION_SPACE[spId]
    if (sepSpace && !inWater) {
      const isJuv  = pos.age < (LIFESPAN[spId] ?? Infinity) * 0.2
      const mySpace = isJuv ? sepSpace * 0.25 : sepSpace
      for (const [sid, sp] of (bySpecies[spId] ?? [])) {
        if (sid === id) continue
        if (sid === pos.mateTargetId) continue  // don't push away your mate
        const dx = pos.x - sp.x, dy = pos.y - sp.y
        const d  = Math.sqrt(dx * dx + dy * dy)
        if (d < mySpace && d > 0) {
          const push = (1 - d / mySpace) * 4.0
          ax += (dx / d) * push
          ay += (dy / d) * push
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
    const atCapacity = pop + (pendingOffspring[spId] ?? 0) >= k

    // ── Beetle egg-laying: find a new tree, travel to it, hatch there ──
    if (spId === 'beetle' && !atCapacity && pos.hunger > 55 && (pos.cooldowns?.breed ?? 0) === 0) {
      const trees = bySpecies['tree'] ?? []
      // Acquire a new breed-tree (prefer one different from home)
      if (!pos.breedTreeId && trees.length > 0) {
        const candidates = trees.filter(([tid]) => tid !== pos.homeTreeId)
        const pool = candidates.length > 0 ? candidates : trees
        // Pick the nearest candidate within awareness range
        let best = null, bestD2 = awarenessR ** 2
        for (const [tid, te] of pool) {
          const d2 = (te.x - pos.x) ** 2 + (te.y - pos.y) ** 2
          if (d2 < bestD2) { bestD2 = d2; best = tid }
        }
        pos.breedTreeId = best
      }
      // Arrived at breed tree — lay eggs
      if (pos.breedTreeId) {
        const bt = posMap.get(pos.breedTreeId)
        if (bt) {
          const d = Math.sqrt((bt.x - pos.x) ** 2 + (bt.y - pos.y) ** 2)
          if (d < EAT_DISTANCE * 1.5) {
            const eggCount = 2 + Math.floor(Math.random() * 3)  // 2–4 eggs
            for (let e = 0; e < eggCount; e++) {
              const child = asexualOffspring({ variation: pos.variation ?? {} })
              const childCarriers = new Set()
              for (const mutId of (pos.carriers ?? [])) {
                if (Math.random() < 0.5) childCarriers.add(mutId)
              }
              toAdd.push({
                id: child.id, entry: {
                  x: bt.x + (Math.random() - 0.5) * 3 * ISLAND_SCALE,
                  y: bt.y + (Math.random() - 0.5) * 3 * ISLAND_SCALE,
                  vx: 0, vy: 0, spId: 'beetle',
                  gender: Math.random() < 0.5 ? 'M' : 'F',
                  variation: child.variation,
                  carriers: childCarriers,
                  state: 'wander', targetId: null,
                  homeTreeId: pos.breedTreeId,
                  breedTreeId: null,
                  hunger: 90, age: 0, cooldowns: { breed: 0 },
                },
              })
            }
            pendingOffspring['beetle'] = (pendingOffspring['beetle'] ?? 0) + eggCount
            const cooldown = Math.round(BREED_COOLDOWN * (1.5 - effFertility / 100))
            pos.cooldowns.breed = cooldown
            pos.breedTreeId = null
          }
        } else {
          pos.breedTreeId = null  // tree was eaten while travelling
        }
      }
    }

    if (hasGender && spId !== 'beetle' && !atCapacity && !fleeing && pos.hunger > 40 && (pos.cooldowns?.breed ?? 0) === 0) {
      const tickOfYear = ((currentTick % 12) + 12) % 12
      const inSeason   = BREEDING_TICKS[spId]?.includes(tickOfYear) ?? true

      if (!inSeason) {
        // Out of season — abandon any pending courtship
        if (pos.mateTargetId) pos.mateTargetId = null
      } else if (pos.mateTargetId) {
        // ── Already courting: check if they've met ────────────────────
        const mate = posMap.get(pos.mateTargetId)
        if (!mate || mate.mateTargetId !== id || (mate.cooldowns?.breed ?? 0) > 0) {
          pos.mateTargetId = null  // stale — mate moved on or bred with someone else
        } else {
          // Frogs must both be in water to complete mating
          if (spId === 'frog') {
            const mateBiome = biomeAt ? biomeAt(mate.x, mate.y) : 'plains'
            if (!FROG_WATER_BIOMES.has(biome) || !FROG_WATER_BIOMES.has(mateBiome)) {
              // keep approaching, just can't breed yet
            } else {
              const d = Math.sqrt((mate.x - pos.x) ** 2 + (mate.y - pos.y) ** 2)
              if (d < MATE_DISTANCE) {
                // Lay a clutch of eggs — each hatches into a tadpole with high death rate
                const eggCount = 5 + Math.floor(Math.random() * 4)  // 5–8 eggs
                for (let e = 0; e < eggCount; e++) {
                  const child = sexualOffspring({ variation: pos.variation ?? {} }, { variation: mate.variation ?? {} })
                  const childCarriers = new Set()
                  for (const mutId of new Set([...(pos.carriers ?? []), ...(mate.carriers ?? [])])) {
                    if (Math.random() < 0.5) childCarriers.add(mutId)
                  }
                  toAdd.push({ id: child.id, entry: {
                    x: pos.x + (Math.random() - 0.5) * 5 * ISLAND_SCALE,
                    y: pos.y + (Math.random() - 0.5) * 5 * ISLAND_SCALE,
                    vx: 0, vy: 0, spId: 'frog_egg',
                    gender: child.gender, variation: child.variation, carriers: childCarriers,
                    state: 'wander', targetId: null, eggTimer: FROG_EGG_HATCH_TIME,
                    hunger: 100, age: 0, cooldowns: {},
                  }})
                }
                pendingOffspring['frog_egg'] = (pendingOffspring['frog_egg'] ?? 0) + eggCount
                const cooldown = Math.round(BREED_COOLDOWN * (1.5 - effFertility / 100))
                pos.cooldowns.breed = cooldown
                mate.cooldowns.breed = cooldown
                pos.mateTargetId = null
                mate.mateTargetId = null
              }
            }
          } else {
            const d = Math.sqrt((mate.x - pos.x) ** 2 + (mate.y - pos.y) ** 2)
            if (d < MATE_DISTANCE) {
              const child = sexualOffspring({ variation: pos.variation ?? {} }, { variation: mate.variation ?? {} })
              const childCarriers = new Set()
              for (const mutId of new Set([...(pos.carriers ?? []), ...(mate.carriers ?? [])])) {
                if (Math.random() < 0.5) childCarriers.add(mutId)
              }
              toAdd.push({ id: child.id, entry: {
                x: pos.x + (Math.random() - 0.5) * 30 * ISLAND_SCALE,
                y: pos.y + (Math.random() - 0.5) * 30 * ISLAND_SCALE,
                vx: 0, vy: 0, spId, gender: child.gender, variation: child.variation,
                carriers: childCarriers, state: 'wander', targetId: null,
                hunger: 80, age: 0, cooldowns: { breed: 0 },
              }})
              pendingOffspring[spId] = (pendingOffspring[spId] ?? 0) + 1
              const cooldown = Math.round(BREED_COOLDOWN * (1.5 - effFertility / 100))
              pos.cooldowns.breed = cooldown
              mate.cooldowns.breed = cooldown
              pos.mateTargetId = null
              mate.mateTargetId = null
            }
          }
        }
      } else if (pos.gender === 'F') {
        // ── Female evaluates available males in awareness range ────────
        const males = bySpecies[spId] ?? []
        let chosenId = null, bestDesirability = -1

        for (const [mid, me] of males) {
          if (me.gender !== 'M') continue
          if ((me.cooldowns?.breed ?? 0) > 0) continue
          if (me.hunger <= 40) continue
          if (me.mateTargetId) continue  // already courting someone else

          const d = Math.sqrt((me.x - pos.x) ** 2 + (me.y - pos.y) ** 2)
          if (d > awarenessR) continue  // out of sight

          // Male desirability: honest signals of genetic fitness
          const mSpeed  = Math.min(100, Math.max(0, (base.speed        ?? 50) + (me.variation?.speed        ?? 0)))
          const mStr    = Math.min(100, Math.max(0, (base.strength     ?? 50) + (me.variation?.strength     ?? 0)))
          const mConst  = Math.min(100, Math.max(0, (base.constitution ?? 50) + (me.variation?.constitution ?? 0)))
          const mResil  = Math.min(100, Math.max(0, (base.resilience   ?? 50) + (me.variation?.resilience   ?? 0)))
          const desirability = (mSpeed + mStr + mConst + mResil) / 4

          // Female threshold: higher reasoning = pickier mate choice
          const threshold = 28 + (effReasoning / 100) * 38  // 28–66 range

          if (desirability >= threshold && desirability > bestDesirability) {
            bestDesirability = desirability
            chosenId = mid
          }
        }

        if (chosenId !== null) {
          pos.mateTargetId = chosenId
          const chosenMale = posMap.get(chosenId)
          if (chosenMale) chosenMale.mateTargetId = id
        }
      }
    }
  }

  // ── Frog egg hatch ───────────────────────────────────────────────────
  for (const [eid, epos] of posMap) {
    if (epos.spId !== 'frog_egg') continue
    epos.age = (epos.age ?? 0) + speedMultiplier
    epos.eggTimer = (epos.eggTimer ?? 0) - speedMultiplier
    if (epos.eggTimer > 0) continue
    // Hatch: spawn one tadpole per egg, then remove the egg
    toAdd.push({ id: freshId(), entry: {
      x: epos.x + (Math.random() - 0.5) * 3 * ISLAND_SCALE,
      y: epos.y + (Math.random() - 0.5) * 3 * ISLAND_SCALE,
      vx: 0, vy: 0, spId: 'frog_tadpole',
      gender: epos.gender, variation: epos.variation ?? {},
      carriers: epos.carriers ?? new Set(),
      state: 'wander', targetId: null, orbitPhase: Math.random() * Math.PI * 2,
      hunger: 100, age: 0, cooldowns: {},
    }})
    toRemove.push({ id: eid, spId: 'frog_egg', cause: 'age' })
  }

  // ── Stationary plants: age increment + tree seed dispersal ──────────
  const SEED_STAT_KEYS = ['speed','resilience','metabolism','camouflage','heatTolerance','strength','reasoning','fertility','constitution']
  for (const [, pos] of posMap) {
    if (!STATIONARY_SPECIES.has(pos.spId)) continue
    pos.age = (pos.age ?? 0) + speedMultiplier

    if (pos.spId !== 'tree' || pos.age < TREE_ADULT_AGE) continue

    const base    = resolvedBases['tree'] ?? {}
    const effFert = Math.min(100, Math.max(0, (base.fertility  ?? 15) + (pos.variation?.fertility  ?? 0)))
    const effMet  = Math.min(100, Math.max(0, (base.metabolism ?? 38) + (pos.variation?.metabolism ?? 0)))
    const effStr  = Math.min(100, Math.max(0, (base.strength   ?? 12) + (pos.variation?.strength   ?? 0)))

    if (effFert <= 0) continue  // cannot seed without fertility

    const dropChance = TREE_SEED_DROP_CHANCE * (0.5 + effMet / 200) * (effFert / 100) * speedMultiplier
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

  for (const entry of toRemove) {
    const eid = typeof entry === 'string' ? entry : entry?.id
    if (eid) posMap.delete(eid)
  }
  for (const { id: nid, entry } of toAdd) posMap.set(nid, entry)

  // Aggregate deaths by species + cause for the death log
  if (deathLogRef) {
    for (const entry of toRemove) {
      if (!entry || typeof entry === 'string') continue
      const { spId: dSpId, cause } = entry
      if (!dSpId || !cause) continue
      if (!deathLogRef.current[dSpId]) deathLogRef.current[dSpId] = {}
      deathLogRef.current[dSpId][cause] = (deathLogRef.current[dSpId][cause] ?? 0) + 1
    }
  }
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
  focusViewportRef = null, diversityRef = null, deathLogRef = null,
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
        stepMovement(posMap, biomeAt ?? (() => 'plains'), resolvedBases, biomeScoresRef, spMult, simTickRef?.current ?? 0, diversityRef, deathLogRef)

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
    if (!vp) return
    const wx = (cssX - vp.panX) / vp.scale
    const wy = (cssY - vp.panY) / vp.scale
    let best = null, bestDist = Infinity
    for (const [id, pos] of positionsRef.current) {
      if (!pos.spId) continue
      // Trees are drawn bottom-anchored; offset pick target to visual centre
      const pickCx = pos.x
      const pickCy = STATIONARY_SPECIES.has(pos.spId) ? pos.y - 20 / vp.scale : pos.y
      // Screen-space pick radius: larger for big stationary sprites
      const screenR = STATIONARY_SPECIES.has(pos.spId) ? 36 : 22
      const pickWorld = screenR / vp.scale
      const dist = Math.sqrt((wx - pickCx) ** 2 + (wy - pickCy) ** 2)
      if (dist < pickWorld && dist < bestDist) { bestDist = dist; best = { speciesId: pos.spId, indId: id, cssX, cssY } }
    }
    if (best) setSelectedInd(best)
    else setSelectedInd(null)
  }

  // Capture-phase click listener — fires before any child stopPropagation.
  // Tracks pointer-down position itself so it works even when a hotspot
  // button stops mousedown propagation.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let downX = 0, downY = 0
    const onDown = (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY } }
    const onClick = (e) => {
      if (e.button !== 0) return
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return  // was a drag
      if (e.target.closest('.island-hotspot')) return  // hotspot buttons open gene editor, not card
      const rect = wrap.getBoundingClientRect()
      pickIndividual(e.clientX - rect.left, e.clientY - rect.top)
    }
    wrap.addEventListener('pointerdown', onDown,   { capture: true })
    wrap.addEventListener('click',       onClick,  { capture: true })
    return () => {
      wrap.removeEventListener('pointerdown', onDown,   { capture: true })
      wrap.removeEventListener('click',       onClick,  { capture: true })
    }
  }, []) // pickIndividual only uses stable refs + setSelectedInd

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
        const ind   = entry ? { id: selectedInd.indId, gender: entry.gender, variation: entry.variation ?? {}, age: entry.age ?? 0, hunger: entry.hunger ?? null, state: entry.state ?? null } : null
        const { width: cw, height: ch } = sizeRef.current
        return sp && ind ? (
          <IndividualCard
            species={sp}
            individual={ind}
            resolvedBase={base}
            idx={0}
            cssX={selectedInd.cssX}
            cssY={selectedInd.cssY}
            canvasW={cw}
            canvasH={ch}
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
