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
      speed:          5,
      resilience:    72,
      metabolism:    58,
      camouflage:    65,
      heatTolerance: 68,
      strength:       5,
    },
  },
  {
    id: 'tree',
    emoji: '🌳',
    name: 'Island Fig',
    trophic: 'Perennial Producer',
    pop: 30,
    renewable: true,   // fruit grows back — population never drops to 0
    dna: ['ATG', 'CTA', 'TGC'],
    stats: {
      speed:          0,
      resilience:    95,
      metabolism:    38,
      camouflage:    28,
      heatTolerance: 62,
      strength:      12,
    },
  },
  {
    id: 'beetle',
    emoji: '🪲',
    name: 'Rock Beetle',
    trophic: 'Primary Consumer',
    pop: 85,
    dna: ['TGC', 'AAT', 'TAA'],
    stats: {
      speed:         28,
      resilience:    82,
      metabolism:    48,
      camouflage:    72,
      heatTolerance: 58,
      strength:      42,
    },
  },
  {
    id: 'deer',
    emoji: '🦌',
    name: 'Leaf Deer',
    trophic: 'Primary Consumer',
    pop: 40,
    dna: ['ACG', 'GCC', 'TAA'],
    stats: {
      speed:         85,
      resilience:    42,
      metabolism:    60,
      camouflage:    52,
      heatTolerance: 38,
      strength:      28,
    },
  },
  {
    id: 'frog',
    emoji: '🐸',
    name: 'Marsh Frog',
    trophic: 'Secondary Consumer',
    pop: 28,
    dna: ['AAT', 'GCC', 'ATG'],
    stats: {
      speed:         62,
      resilience:    38,
      metabolism:    50,
      camouflage:    92,
      heatTolerance: 18,
      strength:      22,
    },
  },
  {
    id: 'hawk',
    emoji: '🦅',
    name: 'Island Hawk',
    trophic: 'Apex Predator',
    pop: 8,
    dna: ['GAC', 'GGC', 'ACG'],
    stats: {
      speed:         95,
      resilience:    52,
      metabolism:    88,
      camouflage:    14,
      heatTolerance: 70,
      strength:      92,
    },
  },
  {
    id: 'fungi',
    emoji: '🍄',
    name: 'Shelf Fungi',
    trophic: 'Decomposer',
    pop: 110,
    dna: ['CTA', 'ATG', 'TGC'],
    stats: {
      speed:          0,
      resilience:    94,
      metabolism:    22,
      camouflage:    58,
      heatTolerance: 38,
      strength:       5,
    },
  },
]

// Overall fitness = average of all stats
export function overallFitness(stats) {
  const vals = Object.values(stats)
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}
