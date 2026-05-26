// Biome definitions — single source of truth for environment properties.
// Each biome's color matches the pixel drawn on the island art canvas.
// Use these values to drive simulation mechanics.

export const BIOMES = {
  DEEP_OCEAN: {
    id: 'DEEP_OCEAN',
    label: 'Deep Ocean',
    color: '#7ab4cc',
    // Environment
    elevation: -10,   // metres below sea level
    temp: 12,         // base temperature °C
    humidity: 100,    // % relative humidity
    // Survival
    traversable: false,   // land animals cannot enter
    foodDensity: 1,       // base food units available (0–10)
    fertility: 0,         // plant growth potential (0–10)
    shelter: 0,           // protection from predators/weather (0–10)
    hazard: 8,            // environmental danger (0–10)
    waterAvailable: true,
  },

  SHALLOW_WATER: {
    id: 'SHALLOW_WATER',
    label: 'Shallow Water',
    color: '#4a9ebb',
    elevation: -1,
    temp: 18,
    humidity: 100,
    traversable: false,
    foodDensity: 4,
    fertility: 2,
    shelter: 1,
    hazard: 3,
    waterAvailable: true,
  },

  BEACH: {
    id: 'BEACH',
    label: 'Beach',
    color: '#d4b483',
    elevation: 0,
    temp: 28,
    humidity: 30,
    traversable: true,
    foodDensity: 2,
    fertility: 1,
    shelter: 0,
    hazard: 1,
    waterAvailable: false,
  },

  WETLAND: {
    id: 'WETLAND',
    label: 'Wetland',
    color: '#4d6b52',
    elevation: 1,
    temp: 22,
    humidity: 90,
    traversable: true,
    foodDensity: 8,
    fertility: 8,
    shelter: 5,
    hazard: 2,
    waterAvailable: true,  // freshwater pools
  },

  GRASSLAND: {
    id: 'GRASSLAND',
    label: 'Grassland',
    color: '#7ab85c',
    elevation: 2,
    temp: 24,
    humidity: 55,
    traversable: true,
    foodDensity: 6,
    fertility: 7,
    shelter: 2,
    hazard: 0,
    waterAvailable: false,
  },

  FOREST: {
    id: 'FOREST',
    label: 'Forest',
    color: '#3a7030',
    elevation: 3,
    temp: 20,
    humidity: 75,
    traversable: true,
    foodDensity: 9,
    fertility: 9,
    shelter: 8,
    hazard: 1,
    waterAvailable: false,
  },

  HIGHLAND: {
    id: 'HIGHLAND',
    label: 'Highland',
    color: '#8b7355',
    elevation: 5,
    temp: 15,
    humidity: 45,
    traversable: true,
    foodDensity: 3,
    fertility: 3,
    shelter: 4,
    hazard: 3,
    waterAvailable: false,
  },

  ROCKY_PEAK: {
    id: 'ROCKY_PEAK',
    label: 'Rocky Peak',
    color: '#787068',
    elevation: 8,
    temp: 8,
    humidity: 40,
    traversable: false,
    foodDensity: 1,
    fertility: 0,
    shelter: 6,
    hazard: 6,
    waterAvailable: false,
  },
}

// Reverse lookup: hex color → biome key
// Useful for pixel-sampling biome detection on the art canvas.
// Note: boundary pixels are antialiased — compare with tolerance, not equality.
export const COLOR_TO_BIOME = Object.fromEntries(
  Object.entries(BIOMES).map(([key, b]) => [b.color, key])
)

// Ordered from lowest to highest elevation (useful for gradient rendering / UI legends)
export const BIOME_ELEVATION_ORDER = [
  'DEEP_OCEAN', 'SHALLOW_WATER', 'BEACH', 'WETLAND',
  'GRASSLAND', 'FOREST', 'HIGHLAND', 'ROCKY_PEAK',
]
