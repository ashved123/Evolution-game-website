// Single source of truth for all species data.
// stats are base values (0–100) before DNA modifiers are applied.

export const SPECIES = [
  {
    id: 'grass',
    emoji: '🌿',
    name: 'Island Grass',
    trophic: 'Producer',
    pop: 240,
    dna: ['ATG', 'GCC', 'TAA'],
    stats: {
      speed:        10,
      resilience:   80,
      metabolism:   35,
      camouflage:   60,
      heatTolerance:70,
      strength:      5,
    },
  },
  {
    id: 'beetle',
    emoji: '🪲',
    name: 'Rock Beetle',
    trophic: 'Primary Consumer',
    pop: 80,
    dna: ['AAT', 'ATG', 'TAA'],
    stats: {
      speed:        45,
      resilience:   65,
      metabolism:   60,
      camouflage:   75,
      heatTolerance:55,
      strength:     20,
    },
  },
  {
    id: 'deer',
    emoji: '🦌',
    name: 'Leaf Deer',
    trophic: 'Primary Consumer',
    pop: 45,
    dna: ['GCC', 'ATG', 'TAA'],
    stats: {
      speed:        75,
      resilience:   50,
      metabolism:   65,
      camouflage:   45,
      heatTolerance:40,
      strength:     35,
    },
  },
  {
    id: 'frog',
    emoji: '🐸',
    name: 'Marsh Frog',
    trophic: 'Secondary Consumer',
    pop: 30,
    dna: ['AAT', 'GCC', 'ATG'],
    stats: {
      speed:        60,
      resilience:   45,
      metabolism:   55,
      camouflage:   85,
      heatTolerance:25,
      strength:     25,
    },
  },
  {
    id: 'hawk',
    emoji: '🦅',
    name: 'Island Hawk',
    trophic: 'Apex Predator',
    pop: 8,
    dna: ['GAC', 'GGC', 'TAA'],
    stats: {
      speed:        88,
      resilience:   60,
      metabolism:   80,
      camouflage:   20,
      heatTolerance:65,
      strength:     85,
    },
  },
  {
    id: 'fungi',
    emoji: '🍄',
    name: 'Fungi',
    trophic: 'Decomposer',
    pop: 120,
    dna: ['CTA', 'ATG', 'TAA'],
    stats: {
      speed:         5,
      resilience:   90,
      metabolism:   30,
      camouflage:   50,
      heatTolerance:45,
      strength:      5,
    },
  },
]

// Overall fitness = average of all stats
export function overallFitness(stats) {
  const vals = Object.values(stats)
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}
