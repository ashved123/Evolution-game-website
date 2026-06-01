import { SPECIES } from '../data/species.js'
import { TICKS_PER_YEAR } from './engine.js'

const VARIATION_RANGE = 12   // initial gene spread ±12 per stat
const MUTATION_RANGE  = 4    // per-stat mutation on reproduction

// Stable monotonic ID so positions can be tracked across fitness re-sorts
let _nextId = 0
export const freshId = () => ++_nextId

const STAT_KEYS = ['speed', 'resilience', 'metabolism', 'camouflage', 'heatTolerance', 'strength', 'reasoning']

// Which tick-within-year each animal species enters breeding season.
// Plants (grass, tree, fungi) reproduce asexually year-round → null.
export const BREEDING_TICKS = {
  grass:  null,
  tree:   null,
  fungi:  null,
  beetle: [2, 3, 4],    // late spring — insects wait for warmth
  deer:   [0, 1, 2],    // early spring — rut before summer growth
  frog:   [1, 2, 3],    // mid-spring — amphibians need warm rain
  hawk:   [0, 1],       // very early spring — raptors nest first
  firefly: null,       // asexual, no season — spawn-then-die every tick
}

export const SEASONS = [
  { name: 'Spring', emoji: '🌸', ticks: [0, 1, 2]  },
  { name: 'Summer', emoji: '☀️',  ticks: [3, 4, 5]  },
  { name: 'Autumn', emoji: '🍂', ticks: [6, 7, 8]  },
  { name: 'Winter', emoji: '❄️',  ticks: [9, 10, 11] },
]

export function getSeason(tick) {
  const t = ((tick % TICKS_PER_YEAR) + TICKS_PER_YEAR) % TICKS_PER_YEAR
  return SEASONS.find(s => s.ticks.includes(t)) ?? SEASONS[0]
}

export function isBreeding(speciesId, tick) {
  const ticks = BREEDING_TICKS[speciesId]
  if (ticks === null) return true   // plants always reproduce
  const t = ((tick % TICKS_PER_YEAR) + TICKS_PER_YEAR) % TICKS_PER_YEAR
  return ticks.includes(t)
}

// ── helpers ─────────────────────────────────────────────────────────

function randDelta(range) {
  // Gaussian-ish: average two uniforms to cluster near 0
  return Math.round(((Math.random() - 0.5) + (Math.random() - 0.5)) * range)
}

function newVariation() {
  return Object.fromEntries(STAT_KEYS.map(k => [k, randDelta(VARIATION_RANGE)]))
}

// Sexual reproduction: child gets mean of both parents' variations + mutation
export function sexualOffspring(parentA, parentB) {
  const variation = {}
  for (const key of STAT_KEYS) {
    const avg = (parentA.variation[key] + parentB.variation[key]) / 2
    variation[key] = Math.round(avg + randDelta(MUTATION_RANGE))
  }
  return { id: freshId(), gender: Math.random() < 0.5 ? 'M' : 'F', variation }
}

// Asexual reproduction: child inherits parent variation + mutation (plants, off-season)
export function asexualOffspring(parent) {
  const variation = {}
  for (const key of STAT_KEYS) {
    variation[key] = parent.variation[key] + randDelta(MUTATION_RANGE)
  }
  return { id: freshId(), gender: null, variation }
}

function randomIndividual(hasGender) {
  return { id: freshId(), gender: hasGender ? (Math.random() < 0.5 ? 'M' : 'F') : null, variation: newVariation() }
}

// ── public API ───────────────────────────────────────────────────────

// Species present at game start — animals arrive later via the arrival schedule.
const STARTER_SPECIES = new Set(['tree'])

export function initIndividuals() {
  const out = {}
  for (const sp of SPECIES) {
    if (!STARTER_SPECIES.has(sp.id)) { out[sp.id] = []; continue }
    const hasGender = BREEDING_TICKS[sp.id] !== null
    out[sp.id] = Array.from({ length: Math.round(sp.pop) }, () => randomIndividual(hasGender))
  }
  return out
}

// Create a founding population of `count` individuals for a newly arrived species.
export function spawnIndividuals(spId, count) {
  const hasGender = BREEDING_TICKS[spId] !== null
  return Array.from({ length: count }, () => randomIndividual(hasGender))
}


// ── stat helpers (used by UI components) ────────────────────────────

// Effective stats for one individual: DNA-resolved base + variation, clamped 0–100
export function effectiveStats(resolvedBase, variation) {
  const out = {}
  for (const [key, val] of Object.entries(resolvedBase)) {
    out[key] = Math.min(100, Math.max(0, val + (variation?.[key] ?? 0)))
  }
  return out
}

// Mean effective stats across all individuals in a pool
export function averageStats(pool, resolvedBase) {
  if (!pool || pool.length === 0) return resolvedBase
  const keys = Object.keys(resolvedBase)
  const sums = Object.fromEntries(keys.map(k => [k, 0]))
  for (const ind of pool) {
    for (const key of keys) {
      sums[key] += Math.min(100, Math.max(0, (resolvedBase[key] ?? 0) + (ind.variation[key] ?? 0)))
    }
  }
  return Object.fromEntries(keys.map(k => [k, Math.round(sums[k] / pool.length)]))
}
