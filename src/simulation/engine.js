import { applyDNA } from '../data/codons.js'

// 12 ticks = 1 in-game year
export const TICKS_PER_YEAR = 12

// Carrying capacities (producers + decomposer only; animals are IBM-driven)
// Grass/tree K sets the food ceiling that emergently caps herbivore populations.
// Sized using the 10% energy rule: grass K 800 can sustain ~80 units of herbivore biomass.
export const K = {
  grass: 800, tree: 100, fungi: 350,
}

// Logistic growth rates per tick for producers
const PRODUCER_R = { grass: 0.22, tree: 0.022 }

// Natural death rate per tick for producers + decomposer
const NAT_DEATH = {
  grass: 0.008, tree: 0.002, fungi: 0.008,
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
    overseerText:   'A drought has begun. Water is a limiting factor — without it, your producers cannot sustain the food web above them.\n\nHerbivore food supplies will shrink. Watch your population numbers carefully.',
    overseerSprite: 'neutral',
    // Cuts grass/tree supply; animals feel it through hunger (IBM handles animal impact)
    apply(p) {
      p.grass *= 0.72; p.tree *= 0.90
    },
  },
  disease: {
    emoji: '🦠', title: 'Disease Outbreak',
    desc: 'A pathogen spreads through the least resilient species.',
    concept: 'Population Dynamics', duration: 2,
    overseerText:   'A disease has emerged. It will target the least resilient population on the island.\n\nThis is natural selection in action. Individuals with higher resilience will survive. The rest will not. That is how the trait spreads.',
    overseerSprite: 'neutral',
    // Targets the animal species with the lowest current population (weakest / most vulnerable)
    apply(p, s, animalPops) {
      const candidates = ['beetle', 'deer', 'frog'].filter(id => (animalPops[id] ?? 0) > 2)
      if (!candidates.length) return
      const target = candidates.reduce((worst, id) =>
        (s[id]?.resilience ?? 50) < (s[worst]?.resilience ?? 50) ? id : worst, candidates[0])
      // Hunger-drain penalty applied via a transient modifier flag on the pops object
      // (canvas reads p.__diseaseTarget to apply extra hunger drain this tick)
      p.__diseaseTarget = target
    },
  },
  wildfire: {
    emoji: '🔥', title: 'Wildfire',
    desc: 'A fire sweeps the island — bottleneck effect, sharp population drops.',
    concept: 'Bottleneck Effect', duration: 2,
    overseerText:   'Wildfire. A significant portion of your vegetation is gone.\n\nThis is what we call a bottleneck event — a sudden environmental catastrophe that eliminates most of a population. The survivors carry a narrower genetic profile. Evolution will resume from there.',
    overseerSprite: 'threat',
    apply(p) {
      p.grass *= 0.40; p.tree *= 0.65
      // IBM animals experience fire indirectly: food supply collapses
    },
  },
  cold_snap: {
    emoji: '❄️', title: 'Cold Snap',
    desc: 'Temperatures plummet. Ectotherms struggle to survive.',
    concept: 'Adaptation', duration: 3,
    overseerText:   'Temperatures have dropped sharply. Ectotherms — cold-blooded animals like frogs and monitor lizards — cannot regulate their own body heat. They are at the mercy of the environment.\n\nThis is why heat tolerance matters. Use the Gene Lab if you must.',
    overseerSprite: 'neutral',
    apply(p, s) {
      // Cold snap marked on pops so canvas can apply extra hunger to cold-vulnerable species
      p.__coldSnap = true
    },
  },
  migration: {
    emoji: '🌊', title: 'New Migration',
    desc: 'New arrivals wash ashore, boosting herbivore populations.',
    concept: 'Population Growth', duration: 1,
    overseerText:   'A new wave of migrants has arrived from a neighbouring island. Herbivore populations will increase.\n\nMore prey means more food for predators. Predator numbers will follow. This is standard population dynamics.',
    overseerSprite: 'friendly',
    // Signals canvas to spawn extra deer/beetle agents this tick
    apply(p) {
      p.__migration = true
    },
  },
  volcanic_ash: {
    emoji: '🌋', title: 'Volcanic Ash',
    desc: 'Ash clouds block sunlight. Photosynthesis slows, energy flow disrupted.',
    concept: 'Matter & Energy Flow', duration: 4,
    overseerText:   'Volcanic ash is blocking sunlight across the island. Photosynthesis will slow. The base of your food chain — the producers — will produce less energy.\n\nEverything above them will feel it. Energy flows up the food web. When the source weakens, the whole chain weakens.',
    overseerSprite: 'neutral',
    apply(p) {
      p.grass *= 0.82; p.tree *= 0.88
    },
  },
}

const EVENT_IDS = Object.keys(EVENTS)

// ── Main tick function ───────────────────────────────────────────────
// state: { pops, deadMatter, nutrients, tick, year, event, log }
// dnaBySpecies: { [id]: { baseStats, dna } }
// animalPops: { [id]: count } — live animal counts from posMap (written by canvas each frame)
export function tick(state, dnaBySpecies, animalPops = {}) {
  // Deep-copy mutable parts
  const pops = { ...state.pops }
  let dead = state.deadMatter
  let nutrients = state.nutrients
  const tickN = state.tick + 1
  const year = Math.floor(tickN / TICKS_PER_YEAR) + 1

  // Resolve effective stats from DNA (producers + fungi only needed here)
  const stats = {}
  for (const [id, { baseStats, dna }] of Object.entries(dnaBySpecies)) {
    stats[id] = applyDNA(baseStats, dna)
  }

  // ── 1. Decomposer cycle ──────────────────────────────────────────
  if (pops.fungi > 0 && dead > 0) {
    const consumed = Math.min(dead, pops.fungi * FUNGI_EAT)
    dead -= consumed
    nutrients += consumed * NUTRIENT_RETURN
    const fungiGrowth = consumed * 0.08
    const fungiDeaths = pops.fungi * NAT_DEATH.fungi * deathMult(stats.fungi)
    pops.fungi = clamp(pops.fungi + fungiGrowth - fungiDeaths, 0, K.fungi * 1.1)
    dead += fungiDeaths * 0.4
  } else {
    const fungiDeaths = pops.fungi * NAT_DEATH.fungi * deathMult(stats.fungi)
    pops.fungi = clamp(pops.fungi - fungiDeaths, 0, K.fungi * 1.1)
    if (dead <= 0) pops.fungi = clamp(pops.fungi * 0.995, 0, K.fungi)
  }

  // ── 2. Producer logistic growth ──────────────────────────────────
  nutrients = clamp(nutrients * 0.88, 0, 120)
  const nutrientFactor = 1 + Math.min(nutrients / 60, NUTRIENT_BOOST)

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

  // Animal deaths contribute dead matter (estimated from animal counts for nutrient cycle)
  // Each tick a small fraction of animals contributes to decomposer pool
  for (const id of ['beetle', 'deer', 'frog', 'hawk']) {
    dead += (animalPops[id] ?? 0) * 0.002
  }

  // ── 3. Environmental events ──────────────────────────────────────
  let { event, log } = state
  let newLog = log

  if (event) {
    event = event.ticksLeft <= 1 ? null : { ...event, ticksLeft: event.ticksLeft - 1 }
  }

  if (!event && tickN > TICKS_PER_YEAR * 2 && Math.random() < 1 / (TICKS_PER_YEAR * 8)) {
    const id  = EVENT_IDS[Math.floor(Math.random() * EVENT_IDS.length)]
    const def = EVENTS[id]
    if (def?.apply) def.apply(pops, stats, animalPops)
    event  = { id, ticksLeft: def.duration }
    newLog = [{ id, year, emoji: def.emoji, title: def.title, concept: def.concept }, ...log.slice(0, 11)]
  }

  for (const id of Object.keys(pops)) {
    if (typeof pops[id] === 'number') pops[id] = Math.max(0, pops[id])
  }

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
