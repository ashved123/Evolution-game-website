// Single source of truth for all species data.
// stats are base values (0–100) before DNA modifiers are applied.
// dna is { [statKey]: [codon1, codon2, codon3] } — neutral ['ATG','TAA','GCC'] adds 0 modifier.

const NEUTRAL = ['ATG', 'TAA', 'GCC']

function neutralDna() {
  return {
    speed:         [...NEUTRAL],
    strength:      [...NEUTRAL],
    constitution:  [...NEUTRAL],
    resilience:    [...NEUTRAL],
    heatTolerance: [...NEUTRAL],
    reasoning:     [...NEUTRAL],
    camouflage:    [...NEUTRAL],
    metabolism:    [...NEUTRAL],
    fertility:     [...NEUTRAL],
  }
}

export const SPECIES = [
  {
    id: 'grass',
    emoji: '🌿',
    name: 'Island Grass',
    trophic: 'Producer',
    pop: 360,
    dna: {
      ...neutralDna(),
      resilience:    ['TGC', 'TAA', 'GCC'],   // +12 — tough stems
      camouflage:    ['CGT', 'TAA', 'GCC'],   // +5  — green colouring
      fertility:     ['ACG', 'ATG', 'GCC'],   // +12 — rapid seeding
    },
    stats: {
      speed:          5,
      resilience:    72,
      metabolism:    58,
      camouflage:    65,
      heatTolerance: 68,
      strength:       5,
      reasoning:      0,
      fertility:     85,
      constitution:  40,
    },
  },
  {
    id: 'tree',
    emoji: '🌳',
    name: 'Island Fig',
    trophic: 'Perennial Producer',
    pop: 45,
    renewable: true,
    dna: {
      ...neutralDna(),
      constitution:  ['ACG', 'TGC', 'GCC'],   // +24 — deep roots, long life
      resilience:    ['ACG', 'ATG', 'GCC'],   // +12 — bark resistance
      strength:      ['CGT', 'TAA', 'GCC'],   // +5  — heavy seed dispersal
      fertility:     ['GGA', 'GTA', 'GTA'],   // -30 — corrupted: seed production at 0
    },
    stats: {
      speed:          0,
      resilience:    95,
      metabolism:    38,
      camouflage:    28,
      heatTolerance: 62,
      strength:      12,
      reasoning:      0,
      fertility:     15,
      constitution:  95,
    },
  },
  {
    id: 'beetle',
    emoji: '🪲',
    name: 'Rock Beetle',
    trophic: 'Primary Consumer',
    pop: 60,
    dna: {
      ...neutralDna(),
      camouflage:    ['TGC', 'CGT', 'GCC'],   // +17 — shell colouring
      resilience:    ['ACG', 'ATG', 'GCC'],   // +12 — exoskeleton
      fertility:     ['TGC', 'ATG', 'GCC'],   // +12 — prolific eggs
    },
    stats: {
      speed:         28,
      resilience:    82,
      metabolism:    48,
      camouflage:    72,
      heatTolerance: 58,
      strength:      42,
      reasoning:     22,
      fertility:     75,
      constitution:  45,
    },
  },
  {
    id: 'deer',
    emoji: '🦌',
    name: 'Leaf Deer',
    trophic: 'Primary Consumer',
    pop: 20,
    dna: {
      ...neutralDna(),
      speed:         ['TGC', 'ATG', 'GCC'],   // +12 — long legs
      reasoning:     ['CGT', 'TAA', 'GCC'],   // +5  — herd awareness
      camouflage:    ['CGT', 'TAA', 'GCC'],   // +5  — dappled coat
    },
    stats: {
      speed:         85,
      resilience:    42,
      metabolism:    60,
      camouflage:    52,
      heatTolerance: 38,
      strength:      28,
      reasoning:     58,
      fertility:     55,
      constitution:  52,
    },
  },
  {
    id: 'frog',
    emoji: '🐸',
    name: 'Marsh Frog',
    trophic: 'Secondary Consumer',
    pop: 18,
    dna: {
      ...neutralDna(),
      camouflage:    ['GAC', 'ACG', 'GCC'],   // +32 — mottled green skin
      metabolism:    ['GTA', 'TAA', 'GCC'],   // -5  — ectotherm efficiency
      fertility:     ['TGC', 'ATG', 'GCC'],   // +12 — spawn clutches
    },
    stats: {
      speed:         62,
      resilience:    38,
      metabolism:    50,
      camouflage:    92,
      heatTolerance: 18,
      strength:      22,
      reasoning:     38,
      fertility:     70,
      constitution:  35,
    },
  },
  {
    id: 'hawk',
    emoji: '🦅',
    name: 'Island Hawk',
    trophic: 'Apex Predator',
    pop: 4,
    dna: {
      ...neutralDna(),
      speed:         ['ACG', 'TGC', 'GCC'],   // +24 — wing muscle
      strength:      ['GAC', 'ATG', 'GCC'],   // +20 — talons
      reasoning:     ['TGC', 'ATG', 'GCC'],   // +12 — hunting instinct
    },
    stats: {
      speed:         95,
      resilience:    52,
      metabolism:    88,
      camouflage:    14,
      heatTolerance: 70,
      strength:      92,
      reasoning:     82,
      fertility:     20,
      constitution:  75,
    },
  },
  {
    id: 'boar',
    emoji: '🐗',
    name: 'Wild Boar',
    trophic: 'Omnivore',
    pop: 10,
    dna: {
      ...neutralDna(),
      strength:      ['ACG', 'TGC', 'GCC'],   // +24 — tusks
      constitution:  ['TGC', 'ATG', 'GCC'],   // +12 — dense hide
      heatTolerance: ['CGT', 'TAA', 'GCC'],   // +5  — thick coat
    },
    stats: {
      speed:         45,
      resilience:    58,
      metabolism:    65,
      camouflage:    35,
      heatTolerance: 55,
      strength:      80,
      reasoning:     52,
      fertility:     60,
      constitution:  65,
    },
  },
  {
    id: 'monitor',
    emoji: '🦎',
    name: 'Monitor Lizard',
    trophic: 'Secondary Predator',
    pop: 6,
    dna: {
      ...neutralDna(),
      heatTolerance: ['TGC', 'ATG', 'GCC'],   // +12 — ectotherm basking
      reasoning:     ['TGC', 'ATG', 'GCC'],   // +12 — ambush strategy
      camouflage:    ['TGC', 'CGT', 'GCC'],   // +17 — scale patterning
    },
    stats: {
      speed:         55,
      resilience:    65,
      metabolism:    72,
      camouflage:    65,
      heatTolerance: 55,
      strength:      68,
      reasoning:     68,
      fertility:     35,
      constitution:  70,
    },
  },
  {
    id: 'firefly',
    emoji: '✨',
    name: 'Pond Firefly',
    trophic: 'Primary Consumer',
    pop: 20,
    dna: {
      ...neutralDna(),
      camouflage:    ['GTA', 'TAA', 'GCC'],   // -5  — glowing makes them visible
      metabolism:    ['TGC', 'ATG', 'GCC'],   // +12 — high-energy bioluminescence
      fertility:     ['ACG', 'ATG', 'GCC'],   // +12 — prolific summer breeding
    },
    stats: {
      speed:         55,
      resilience:    28,
      metabolism:    72,
      camouflage:    25,
      heatTolerance: 42,
      strength:      15,
      reasoning:     18,
      fertility:     80,
      constitution:  30,
    },
  },
  {
    id: 'fungi',
    emoji: '🍄',
    name: 'Shelf Fungi',
    trophic: 'Decomposer',
    pop: 160,
    dna: {
      ...neutralDna(),
      resilience:    ['ACG', 'TGC', 'GCC'],   // +24 — chitin cell walls
      fertility:     ['TGC', 'ATG', 'GCC'],   // +12 — spore dispersal
      metabolism:    ['GTA', 'TAA', 'GCC'],   // -5  — slow decomposer metabolism
    },
    stats: {
      speed:          0,
      resilience:    94,
      metabolism:    22,
      camouflage:    58,
      heatTolerance: 38,
      strength:       5,
      reasoning:      0,
      fertility:     80,
      constitution:  55,
    },
  },
]

// Overall fitness = average of all stats
export function overallFitness(stats) {
  const vals = Object.values(stats)
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}
