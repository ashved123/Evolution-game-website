import { SPECIES } from '../data/species.js'
import { applyDNA } from '../data/codons.js'
import { TICKS_PER_YEAR } from './engine.js'

const VARIATION_RANGE = 12   // initial gene spread ±12 per stat
const MUTATION_RANGE  = 4    // per-stat mutation on reproduction

// Stable monotonic ID so positions can be tracked across fitness re-sorts
let _nextId = 0
const freshId = () => ++_nextId

const STAT_KEYS = ['speed', 'resilience', 'metabolism', 'camouflage', 'heatTolerance', 'strength']

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

// Fitness of one individual = mean of their effective stats (0–100 each).
// biomeOk: true = in preferred biome, false = wrong biome or water, undefined = unknown (no penalty).
// Wrong-biome individuals lose 20 fitness points — resilience and heatTolerance cushion this loss.
function individualFitness(variation, resolvedBase, biomeOk) {
  let total = 0
  for (const key of STAT_KEYS) {
    total += Math.min(100, Math.max(0, (resolvedBase[key] ?? 0) + (variation[key] ?? 0)))
  }
  const base = total / STAT_KEYS.length
  if (biomeOk === false) {
    // Resilience + heatTolerance reduce the penalty (more adaptable organisms survive better)
    const resilience    = Math.min(100, Math.max(0, (resolvedBase.resilience    ?? 50) + (variation.resilience    ?? 0)))
    const heatTolerance = Math.min(100, Math.max(0, (resolvedBase.heatTolerance ?? 50) + (variation.heatTolerance ?? 0)))
    const adaptability  = (resilience + heatTolerance) / 2
    const penalty = 20 * (1 - adaptability / 100)
    return Math.max(0, base - penalty)
  }
  return base
}

// Sexual reproduction: child gets mean of both parents' variations + mutation
function sexualOffspring(parentA, parentB) {
  const variation = {}
  for (const key of STAT_KEYS) {
    const avg = (parentA.variation[key] + parentB.variation[key]) / 2
    variation[key] = Math.round(avg + randDelta(MUTATION_RANGE))
  }
  return { id: freshId(), gender: Math.random() < 0.5 ? 'M' : 'F', variation }
}

// Asexual reproduction: child inherits parent variation + mutation (plants, off-season)
function asexualOffspring(parent) {
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

export function initIndividuals() {
  const out = {}
  for (const sp of SPECIES) {
    const hasGender = BREEDING_TICKS[sp.id] !== null
    out[sp.id] = Array.from({ length: Math.round(sp.pop) }, () => randomIndividual(hasGender))
  }
  return out
}

// Called after every engine tick.
// dnaBySpecies: { [id]: { baseStats, dna } }  — needed to compute fitness for selection pressure.
// currentTick: engine tick number — determines breeding season.
// biomeScores: { [spId]: { [indId]: boolean } } — true = in preferred biome, from IslandCanvas.
export function syncIndividuals(prev, newPops, dnaBySpecies, currentTick, biomeScores) {
  const out = {}

  for (const sp of SPECIES) {
    const pool     = prev[sp.id] ?? []
    const newCount = Math.min(Math.round(newPops[sp.id] ?? 0), 500)
    const hasGender = BREEDING_TICKS[sp.id] !== null
    const breeding  = isBreeding(sp.id, currentTick)

    const { baseStats, dna } = dnaBySpecies?.[sp.id] ?? { baseStats: sp.stats, dna: sp.dna }
    const resolvedBase = applyDNA(baseStats, dna)

    if (newCount <= 0) { out[sp.id] = []; continue }

    // ── Deaths: weakest individuals die first (natural selection) ──
    // Biome stress (wrong environment) reduces effective fitness, making outliers more likely to die.
    const spBiomeScores = biomeScores?.[sp.id] ?? null
    let survivors = pool
    if (newCount < pool.length) {
      const ranked = pool
        .map(ind => ({
          ind,
          fit: individualFitness(ind.variation, resolvedBase, spBiomeScores ? spBiomeScores[ind.id] : undefined),
        }))
        .sort((a, b) => b.fit - a.fit)   // descending fitness
      survivors = ranked.slice(0, newCount).map(x => x.ind)
    }

    // ── Births: fill up to newCount ─────────────────────────────────
    if (newCount > survivors.length) {
      const needed  = newCount - survivors.length
      const newborns = []

      const males   = survivors.filter(i => i.gender === 'M')
      const females = survivors.filter(i => i.gender === 'F')
      const canMate = hasGender && breeding && males.length > 0 && females.length > 0

      for (let b = 0; b < needed; b++) {
        if (canMate) {
          // Pick random male and female — fitter parents are overrepresented because
          // they dominate the survivor pool, giving a soft fitness-proportional selection.
          const dad = males[Math.floor(Math.random() * males.length)]
          const mom = females[Math.floor(Math.random() * females.length)]
          newborns.push(sexualOffspring(dad, mom))
        } else if (survivors.length > 0) {
          // Plants or off-season: clone + mutate
          const parent = survivors[Math.floor(Math.random() * survivors.length)]
          newborns.push(asexualOffspring(parent))
        } else {
          // Population recovering from near-extinction — spontaneous
          newborns.push(randomIndividual(hasGender))
        }
      }

      out[sp.id] = [...survivors, ...newborns]
    } else {
      out[sp.id] = survivors
    }
  }

  return out
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
