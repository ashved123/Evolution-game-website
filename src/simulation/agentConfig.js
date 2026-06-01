import { ISLAND_SCALE as S } from './worldConfig.js'

// Awareness zones — how far each species can detect threats or prey
// Base radii (in original 820×540 world units) × S = actual world units
export const AWARENESS = {
  beetle:  { type: 'circle', radius:  80 * S },
  deer:    { type: 'circle', radius: 110 * S },
  frog:    { type: 'circle', radius:  70 * S },
  boar:    { type: 'circle', radius:  90 * S },  // forager, omnidirectional
  hawk:    { type: 'cone',   radius: 220 * S, halfAngle: Math.PI / 3 },   // 120° forward arc
  monitor: { type: 'cone',   radius: 160 * S, halfAngle: Math.PI / 4 },   // 90° ambush cone
  firefly: { type: 'circle', radius:  55 * S },
}

// Hunger drained per frame at speed=1 (~3-5 min to starvation at 60 fps)
export const HUNGER_RATE = { beetle: 0.008, deer: 0.006, frog: 0.010, hawk: 0.004, boar: 0.007, monitor: 0.005, firefly: 0, frog_tadpole: 0 }

// Hunger restored on a successful eat event
export const HUNGER_GAIN = { grass: 30, tree: 40, beetle: 50, deer: 60, frog: 55, boar: 45, monitor: 55, firefly: 28 }

export const EAT_DISTANCE   = 25 * S   // world units — must be this close to eat
export const MATE_DISTANCE  = 40 * S   // world units — mate proximity
export const BREED_COOLDOWN = 900  // frames between births per individual

// Frames to live at speed=1
export const LIFESPAN = { beetle: 36000, deer: 72000, frog: 54000, hawk: 108000, boar: 72000, monitor: 90000, firefly: 1, frog_tadpole: 99999 }

// Island carrying capacity per animal species — these are the MAXIMUM values under ideal conditions.
// Actual effective K is scaled down by food availability and season (see FOOD_K_FACTOR / SEASON_K_FACTOR).
export const CARRYING_CAPACITY = {
  beetle:  300,
  deer:     60,
  frog:     50,
  hawk:     10,
  boar:     30,
  monitor:  18,
  firefly:  80,
}

// Food sources that each species depends on for carrying capacity, and the "optimal" count
// at which effective K equals base K. Below optimal → K shrinks; above → K grows (capped at 1.5×).
export const FOOD_K_FACTOR = {
  beetle:  { food: ['tree'],                         optimal: 60  },
  deer:    { food: ['grass'],                       optimal: 2000 },
  boar:    { food: ['grass', 'tree', 'beetle'],     optimal: 2200 },
  frog:    { food: ['beetle', 'firefly'],           optimal: 100  },
  hawk:    { food: ['deer', 'frog'],                optimal:  70  },
  monitor: { food: ['frog', 'beetle'],              optimal: 150  },
}

// Seasonal multipliers applied on top of the food-adjusted K.
export const SEASON_K_FACTOR = {
  Spring: 1.15,   // new growth, breeding conditions
  Summer: 1.00,   // baseline
  Autumn: 0.85,   // food supply declining
  Winter: 0.68,   // resource scarcity, cold stress
}

// Which species are eaten by which (predator → [prey])
export const PREY_OF = {
  hawk:    ['deer', 'frog'],
  frog:    ['beetle', 'firefly'],
  beetle:  ['tree'],
  deer:    ['grass'],
  boar:    ['grass', 'tree', 'beetle'],
  monitor: ['frog', 'beetle', 'boar'],
}

// Which species are predators of each (prey → [predators])
export const PREDATORS_OF = {
  deer:    ['hawk'],
  frog:    ['hawk', 'monitor'],
  beetle:  ['frog', 'boar', 'monitor'],
  boar:    ['monitor'],
  grass:   ['deer', 'boar'],
  tree:    ['beetle', 'boar'],
  firefly: ['frog'],
}

// Effective awareness radius adjusted for speed stat
export function effectiveRadius(baseRadius, effSpeed) {
  return baseRadius * (0.6 + effSpeed / 250)
}

// Frog water dependency — frogs desiccate (dry out) when away from moist biomes
export const FROG_WATER_BIOMES  = new Set(['pond', 'wetland_water', 'marsh'])
export const FROG_DESICCATION_DRAIN = 0.014  // extra hunger drain per frame when out of water

// Beetle forest dependency — beetles starve when away from tree canopy
export const BEETLE_FOREST_BIOMES = new Set(['forest', 'dense_veg'])
export const BEETLE_FOREST_DRAIN  = 0.012   // extra hunger drain per frame when outside forest

// Frog egg + tadpole lifecycle timings
export const FROG_EGG_HATCH_TIME       = 400   // age units until eggs hatch into tadpoles
export const FROG_TADPOLE_MORPH_AGE    = 900   // age units until tadpole metamorphoses into adult
export const FROG_TADPOLE_DEATH_CHANCE = 0.002 // per-frame (×speedMult) random death — ~80% die

// Firefly pond dependency — fireflies desiccate rapidly when away from pond biomes
export const FIREFLY_POND_BIOMES   = new Set(['pond'])
export const FIREFLY_DESICCATION_DRAIN = 0.022

// Tree seed dispersal — controlled by strength (distance) and metabolism (drop rate)
export const TREE_ADULT_AGE        = 4000          // frames before sapling becomes adult (~67s at 1×)
export const TREE_SEED_RADIUS_BASE = 110 * S       // base dispersal radius — wider spread across island
export const TREE_SEED_DROP_CHANCE = 0.0010        // slightly higher drop chance for denser forest
export const TREE_MIN_DISTANCE     = 8 * S         // tighter packing for natural forest density

// Per-biome germination success multiplier (applied after seed lands).
// 1.0 = normal; <1.0 = hostile; unlisted biomes default to 0.1 (sparse survival).
export const TREE_BIOME_GERMINATION = {
  forest:        1.0,   // ideal — rich canopy soil
  dense_veg:     0.95,  // nearly as good
  highland:      0.20,  // harsh conditions — rare
  plains:        0.04,  // open grassland suppresses tree seedlings
  marsh:         0.10,
  wetland_water: 0.02,
  pond:          0.01,
}
