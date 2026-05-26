// Island generation presets — used by both the creation preview and the game renderer.
// Each value is a scale multiplier applied to the base island outline polygon.
// wetlandArc: [startDeg, endDeg] for the coastal wetland strip, or null for none.

export const ISLAND_PRESETS = {
  standard: {
    id: 'standard',
    label: 'Standard',
    desc: 'Balanced mix of all biomes',
    shallow:   1.55,
    beach:     1.18,
    grassland: 1.00,
    wetlandArc: [90, 170],
    forest:    0.72,
    highland:  0.42,
    rocky:     0.22,
  },
  volcanic: {
    id: 'volcanic',
    label: 'Volcanic',
    desc: 'Dominant rocky peak, sparse green',
    shallow:   1.45,
    beach:     1.12,
    grassland: 1.00,
    wetlandArc: null,
    forest:    0.60,
    highland:  0.52,
    rocky:     0.38,
  },
  tropical: {
    id: 'tropical',
    label: 'Tropical',
    desc: 'Dense forest, wide coastal wetlands',
    shallow:   1.58,
    beach:     1.18,
    grassland: 1.00,
    wetlandArc: [60, 200],
    forest:    0.78,
    highland:  0.30,
    rocky:     0.14,
  },
  highland: {
    id: 'highland',
    label: 'Highland',
    desc: 'Rugged hills and rocky outcrops',
    shallow:   1.42,
    beach:     1.10,
    grassland: 1.00,
    wetlandArc: null,
    forest:    0.56,
    highland:  0.55,
    rocky:     0.30,
  },
}
