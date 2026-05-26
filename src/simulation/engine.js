import { applyDNA } from '../data/codons.js'

// 12 ticks = 1 in-game year
export const TICKS_PER_YEAR = 12

// Carrying capacities
export const K = {
  grass: 500, tree: 50,
  beetle: 130, deer: 65, frog: 55, hawk: 18, fungi: 200,
}

// Logistic growth rates per tick for producers
const PRODUCER_R = { grass: 0.22, tree: 0.022 }

// Prey consumed per predator per tick — kept small to avoid single-tick crashes
const HUNT = {
  beetle: { grass: 0.024, tree: 0.007 },
  deer:   { grass: 0.030, tree: 0.012 },
  frog:   { beetle: 0.020 },
  hawk:   { deer: 0.012,  frog: 0.025 },
}

// Prey → predator conversion efficiency (abstract biomass units, not strict %)
const CONVERSION = { beetle: 0.45, deer: 0.40, frog: 0.50, hawk: 0.35 }

// Natural (non-predation) death rate per tick (~12 ticks = 1 year)
const NAT_DEATH = {
  grass: 0.008, tree: 0.002,
  beetle: 0.018, deer: 0.014, frog: 0.014, hawk: 0.010, fungi: 0.008,
}

// Dead matter consumed per fungi per tick
const FUNGI_EAT = 0.12
// Fraction of consumed dead matter returned as soil nutrients
const NUTRIENT_RETURN = 0.30
// Max nutrient boost to producer growth rate (fraction)
const NUTRIENT_BOOST = 0.45

// ── Environmental events ─────────────────────────────────────────────
export const EVENTS = {
  drought: {
    emoji: '☀️', title: 'Drought',
    desc: 'Water scarcity stresses all producers. Herbivores face food shortage.',
    concept: 'Limiting Factors', duration: 3,
    apply(p, s) {
      p.grass *= 0.72; p.tree *= 0.90
      for (const id of ['beetle', 'deer', 'frog']) {
        const ht = (s[id]?.heatTolerance ?? 50) / 100
        p[id] *= 0.78 + ht * 0.22
      }
    },
  },
  disease: {
    emoji: '🦠', title: 'Disease Outbreak',
    desc: 'A pathogen spreads through the least resilient species.',
    concept: 'Population Dynamics', duration: 2,
    apply(p, s) {
      const candidates = ['beetle', 'deer', 'frog', 'grass'].filter(id => p[id] > 4)
      if (!candidates.length) return
      const target = candidates.reduce((worst, id) =>
        (s[id]?.resilience ?? 50) < (s[worst]?.resilience ?? 50) ? id : worst, candidates[0])
      p[target] *= 0.50
    },
  },
  wildfire: {
    emoji: '🔥', title: 'Wildfire',
    desc: 'A fire sweeps the island — bottleneck effect, sharp population drops.',
    concept: 'Bottleneck Effect', duration: 2,
    apply(p) {
      p.grass *= 0.40; p.tree *= 0.65
      p.beetle *= 0.60; p.deer *= 0.68; p.frog *= 0.72
    },
  },
  cold_snap: {
    emoji: '❄️', title: 'Cold Snap',
    desc: 'Temperatures plummet. Ectotherms struggle to survive.',
    concept: 'Adaptation', duration: 3,
    apply(p, s) {
      for (const id of ['frog', 'beetle']) {
        const ht = (s[id]?.heatTolerance ?? 40) / 100
        p[id] *= 0.62 + ht * 0.28
      }
    },
  },
  migration: {
    emoji: '🌊', title: 'New Migration',
    desc: 'New arrivals wash ashore, boosting herbivore populations.',
    concept: 'Population Growth', duration: 1,
    apply(p) {
      p.deer   = Math.min(p.deer   + 9,  K.deer)
      p.beetle = Math.min(p.beetle + 16, K.beetle)
    },
  },
  volcanic_ash: {
    emoji: '🌋', title: 'Volcanic Ash',
    desc: 'Ash clouds block sunlight. Photosynthesis slows, energy flow disrupted.',
    concept: 'Matter & Energy Flow', duration: 4,
    apply(p) {
      p.grass *= 0.82; p.tree *= 0.88
    },
  },
}

const EVENT_IDS = Object.keys(EVENTS)

// ── Main tick function ───────────────────────────────────────────────
// state: { pops, deadMatter, nutrients, tick, year, event, log }
// dnaBySpecies: { [id]: { baseStats, dna } }
export function tick(state, dnaBySpecies) {
  // Deep-copy mutable parts
  const pops = { ...state.pops }
  let dead = state.deadMatter
  let nutrients = state.nutrients
  const tickN = state.tick + 1
  const year = Math.floor(tickN / TICKS_PER_YEAR) + 1

  // Resolve effective stats from DNA
  const stats = {}
  for (const [id, { baseStats, dna }] of Object.entries(dnaBySpecies)) {
    stats[id] = applyDNA(baseStats, dna)
  }

  // ── 1. Decomposer cycle ──────────────────────────────────────────
  if (pops.fungi > 0 && dead > 0) {
    const consumed = Math.min(dead, pops.fungi * FUNGI_EAT)
    dead -= consumed
    nutrients += consumed * NUTRIENT_RETURN
    // Fungi grow on food, die naturally
    const fungiGrowth = consumed * 0.08
    const fungiDeaths = pops.fungi * NAT_DEATH.fungi * deathMult(stats.fungi)
    pops.fungi = clamp(pops.fungi + fungiGrowth - fungiDeaths, 0, K.fungi * 1.1)
    dead += fungiDeaths * 0.4
  } else {
    const fungiDeaths = pops.fungi * NAT_DEATH.fungi * deathMult(stats.fungi)
    pops.fungi = clamp(pops.fungi - fungiDeaths, 0, K.fungi * 1.1)
    // Starving fungi slowly die off
    if (dead <= 0) pops.fungi = clamp(pops.fungi * 0.995, 0, K.fungi)
  }

  // ── 2. Producer logistic growth ──────────────────────────────────
  nutrients = clamp(nutrients * 0.88, 0, 120) // nutrients decay
  const nutrientFactor = 1 + Math.min(nutrients / 60, NUTRIENT_BOOST)

  // Plant litter fall — constant organic matter regardless of animal deaths
  dead += (pops.grass * 0.006 + pops.tree * 0.010)

  for (const id of ['grass', 'tree']) {
    const r = PRODUCER_R[id] * nutrientFactor
    const resilBonus = (stats[id]?.resilience ?? 70) / 200
    const growth = r * pops[id] * (1 - pops[id] / K[id]) * (0.7 + resilBonus)
    const deaths = pops[id] * NAT_DEATH[id]
    const minPop  = id === 'tree' ? 3 : 0
    pops[id] = clamp(pops[id] + growth - deaths, minPop, K[id] * 1.15)
    dead += deaths
  }

  // ── 3. Herbivores eat producers ──────────────────────────────────
  for (const hId of ['beetle', 'deer']) {
    if (pops[hId] <= 0) continue
    const sp = stats[hId]
    let eaten = 0

    for (const [preyId, rate] of Object.entries(HUNT[hId])) {
      const take = Math.min(pops[preyId] * 0.10, pops[hId] * rate)
      pops[preyId] = Math.max(0, pops[preyId] - take)
      eaten += take
      dead  += take * 0.08 // food waste
    }

    const growth  = eaten * CONVERSION[hId] * metabMult(sp)
    const deaths  = pops[hId] * NAT_DEATH[hId] * deathMult(sp)
    pops[hId] = clamp(pops[hId] + growth - deaths, 0, K[hId] * 1.1)
    dead += deaths
  }

  // ── 4. Frog eats beetle ──────────────────────────────────────────
  if (pops.frog > 0) {
    if (pops.beetle > 0) {
      const sp = stats.frog
      // Camouflage helps frogs ambush
      const camBonus = 1 + (sp?.camouflage ?? 50) / 250
      const take   = Math.min(pops.beetle * 0.10, pops.frog * HUNT.frog.beetle * camBonus)
      pops.beetle  = Math.max(0, pops.beetle - take)
      const growth = take * CONVERSION.frog * metabMult(sp)
      const deaths = pops.frog * NAT_DEATH.frog * deathMult(sp)
      pops.frog = clamp(pops.frog + growth - deaths, 0, K.frog * 1.1)
      dead += deaths
    } else {
      // Starvation
      pops.frog = clamp(pops.frog * 0.93, 0, K.frog)
      dead += pops.frog * 0.07
    }
  }

  // ── 5. Hawk eats deer + frog ─────────────────────────────────────
  if (pops.hawk > 0) {
    const sp = stats.hawk
    const huntMult = ((sp?.speed ?? 80) + (sp?.strength ?? 80)) / 200
    let eaten = 0

    for (const [preyId, rate] of Object.entries(HUNT.hawk)) {
      if (pops[preyId] <= 0) continue
      const preySp = stats[preyId]
      // Prey escape: combined speed + camouflage vs hawk speed
      const escapeChance = ((preySp?.speed ?? 50) + (preySp?.camouflage ?? 30)) / 350
      const take = Math.min(pops[preyId] * 0.10, pops.hawk * rate * huntMult * (1 - escapeChance * 0.5))
      pops[preyId] = Math.max(0, pops[preyId] - take)
      eaten += take
      dead  += take
    }

    const growth = eaten * CONVERSION.hawk * metabMult(sp)
    const deaths = pops.hawk * NAT_DEATH.hawk * deathMult(sp)
    pops.hawk = clamp(pops.hawk + growth - deaths, 0, K.hawk * 1.1)
    dead += deaths
  }

  // ── 6. Environmental events ──────────────────────────────────────
  let { event, log } = state
  let newLog = log

  // Tick down active event (effects already applied on trigger — ticksLeft is display-only)
  if (event) {
    event = event.ticksLeft <= 1 ? null : { ...event, ticksLeft: event.ticksLeft - 1 }
  }

  // Fire a new event — 2-year warmup, then ~1 event per 4 years on average
  if (!event && tickN > TICKS_PER_YEAR * 2 && Math.random() < 1 / (TICKS_PER_YEAR * 4)) {
    const id  = EVENT_IDS[Math.floor(Math.random() * EVENT_IDS.length)]
    const def = EVENTS[id]
    if (def?.apply) def.apply(pops, stats)   // apply effects exactly once
    event  = { id, ticksLeft: def.duration }
    newLog = [{ id, year, emoji: def.emoji, title: def.title, concept: def.concept }, ...log.slice(0, 11)]
  }

  // Final clamp — no negatives
  for (const id of Object.keys(pops)) pops[id] = Math.max(0, pops[id])

  return {
    pops,
    deadMatter: clamp(dead, 0, 600),
    nutrients:  clamp(nutrients, 0, 120),
    tick: tickN,
    year,
    event,
    log: newLog,
  }
}

// ── helpers ──────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
// Higher resilience → lower death multiplier (0.6–1.4 range)
function deathMult(sp) { return 1.4 - (sp?.resilience ?? 50) / 125 }
// Higher metabolism → better food conversion (0.7–1.3 range)
function metabMult(sp)  { return 0.7 + (sp?.metabolism  ?? 50) / 83  }
