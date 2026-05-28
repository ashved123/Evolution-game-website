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
}

// Hunger drained per frame at speed=1 (~3-5 min to starvation at 60 fps)
export const HUNGER_RATE = { beetle: 0.008, deer: 0.006, frog: 0.010, hawk: 0.004, boar: 0.007, monitor: 0.005 }

// Hunger restored on a successful eat event
export const HUNGER_GAIN = { grass: 30, tree: 40, beetle: 50, deer: 60, frog: 55, boar: 45, monitor: 55 }

export const EAT_DISTANCE   = 25 * S   // world units — must be this close to eat
export const MATE_DISTANCE  = 40 * S   // world units — mate proximity
export const BREED_COOLDOWN = 900  // frames between births per individual

// Frames to live at speed=1
export const LIFESPAN = { beetle: 36000, deer: 72000, frog: 54000, hawk: 108000, boar: 72000, monitor: 90000 }

// Island carrying capacity per animal species — these are the MAXIMUM values under ideal conditions.
// Actual effective K is scaled down by food availability and season (see FOOD_K_FACTOR / SEASON_K_FACTOR).
export const CARRYING_CAPACITY = {
  beetle:  300,
  deer:     60,
  frog:     50,
  hawk:     10,
  boar:     30,
  monitor:  18,
}

// Food sources that each species depends on for carrying capacity, and the "optimal" count
// at which effective K equals base K. Below optimal → K shrinks; above → K grows (capped at 1.5×).
export const FOOD_K_FACTOR = {
  beetle:  { food: ['grass', 'tree'],         optimal: 600 },
  deer:    { food: ['grass', 'tree'],         optimal: 600 },
  boar:    { food: ['grass', 'tree','beetle'], optimal: 550 },
  frog:    { food: ['beetle'],                optimal: 150 },
  hawk:    { food: ['deer',  'frog'],         optimal:  70 },
  monitor: { food: ['frog',  'beetle'],       optimal: 150 },
}

// Seasonal multipliers applied on top of the food-adjusted K.
export const SEASON_K_FACTOR = {
  Spring: 1.15,   // new growth, breeding conditions
  Summer: 1.00,   // baseline
  Autumn: 0.80,   // food supply declining
  Winter: 0.50,   // resource scarcity, cold stress
}

// Which species are eaten by which (predator → [prey])
export const PREY_OF = {
  hawk:    ['deer', 'frog'],
  frog:    ['beetle'],
  beetle:  ['grass', 'tree'],
  deer:    ['grass', 'tree'],
  boar:    ['grass', 'tree', 'beetle'],
  monitor: ['frog', 'beetle'],
}

// Which species are predators of each (prey → [predators])
export const PREDATORS_OF = {
  deer:   ['hawk'],
  frog:   ['hawk', 'monitor'],
  beetle: ['frog', 'boar', 'monitor'],
  grass:  ['beetle', 'deer', 'boar'],
  tree:   ['beetle', 'deer', 'boar'],
}

// Effective awareness radius adjusted for speed stat
export function effectiveRadius(baseRadius, effSpeed) {
  return baseRadius * (0.6 + effSpeed / 250)
}

// Frog water dependency — frogs desiccate (dry out) when away from moist biomes
export const FROG_WATER_BIOMES  = new Set(['pond', 'wetland_water', 'marsh'])
export const FROG_DESICCATION_DRAIN = 0.014  // extra hunger drain per frame when out of water

// Tree seed dispersal — controlled by strength (distance) and metabolism (drop rate)
export const TREE_ADULT_AGE        = 12000         // frames before sapling becomes adult
export const TREE_SEED_RADIUS_BASE = 70 * S        // base dispersal radius
export const TREE_SEED_DROP_CHANCE = 0.00015       // per-frame chance per adult tree (× metabolism factor)
export const TREE_MIN_DISTANCE     = 10 * S        // minimum world-unit gap between any two trees

// Per-biome germination success multiplier (applied after seed lands).
// 1.0 = normal; <1.0 = hostile; unlisted biomes default to 0.1 (sparse survival).
export const TREE_BIOME_GERMINATION = {
  forest:        1.0,   // ideal — canopy, rich soil
  dense_veg:     0.9,   // nearly as good
  highland:      0.35,  // cooler, thinner soil; possible but uncommon
  plains:        0.45,  // open grassland — moderate competition, drier
  marsh:         0.2,   // waterlogged soil suppresses root growth
  wetland_water: 0.05,  // standing water — almost always fails
  pond:          0.02,
}
