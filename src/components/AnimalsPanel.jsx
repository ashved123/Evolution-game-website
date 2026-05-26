import React, { useState } from 'react'
import './AnimalsPanel.css'

const ANIMALS = [
  {
    id: 'grass',
    emoji: '🌿',
    name: 'Island Grass',
    trophic: 'Producer',
    trophicColor: '#5a9068',
    description:
      'The foundation of the entire food web. Island Grass spreads rapidly through underground runners and wind-dispersed seeds, carpeting the terrain after rainfall. Its shallow roots make it vulnerable to drought and overgrazing — when herbivore populations spike, grass coverage collapses, triggering a cascade of starvation through every trophic level above it.',
    traits: ['High heat tolerance', 'Fast regrowth', 'Vulnerable to overgrazing'],
    concepts: ['Producers', 'Autotrophs', 'Limiting Factors'],
  },
  {
    id: 'tree',
    emoji: '🌳',
    name: 'Island Fig',
    trophic: 'Perennial Producer',
    trophicColor: '#2e7d32',
    description:
      'An ancient, slow-growing fig tree that provides a permanent, renewable food source. Unlike grass, the Island Fig cannot be overgrazed — it continuously drops fruit and regenerates leaves without dying. Its deep root system and thick bark give it extraordinary resilience against drought, fire, and disease, making it the most durable organism on the island.',
    traits: ['Renewable food source', 'Fire resistant', 'Immobile', 'Permanent root anchor'],
    concepts: ['Perennial Producers', 'Renewable Resources', 'Resilience'],
    special: 'Fruit regenerates indefinitely — population never reaches zero.',
  },
  {
    id: 'beetle',
    emoji: '🪲',
    name: 'Rock Beetle',
    trophic: 'Primary Consumer',
    trophicColor: '#c08840',
    description:
      'A heavily armoured herbivore with a dense chitinous exoskeleton that resists both predation and water loss. Rock Beetles are slow and conspicuous when moving, but their shell makes them almost impossible for frogs to swallow and difficult for hawks to grip. They graze on both grass and fallen figs, and their populations tend to explode when predator numbers fall.',
    traits: ['Armoured shell (high resilience)', 'Cryptic rock colouring', 'Slow but durable'],
    concepts: ['Adaptation', 'Natural Selection', 'Primary Consumers'],
  },
  {
    id: 'deer',
    emoji: '🦌',
    name: 'Leaf Deer',
    trophic: 'Primary Consumer',
    trophicColor: '#c08840',
    description:
      'A small, skittish herbivore whose only real defence is explosive speed. The Leaf Deer\'s entire physiology is optimised for flight — lightweight frame, powerful hindquarters, and large eyes positioned for near-360° vision. It is highly vulnerable to injury and disease, so a single drought or disease event can cut its population dramatically. As a key prey species for the hawk, deer numbers directly control apex predator health.',
    traits: ['Fastest land animal (speed 85)', 'Very low resilience', 'Key prey species'],
    concepts: ['Predator-Prey Dynamics', 'Adaptation', 'Fitness'],
  },
  {
    id: 'frog',
    emoji: '🐸',
    name: 'Marsh Frog',
    trophic: 'Secondary Consumer',
    trophicColor: '#5070a0',
    description:
      'A sit-and-wait ambush predator with the best camouflage on the island (92). The Marsh Frog lies motionless among leaf litter for hours, then strikes at beetles with a projectile tongue. Its skin must stay moist, making it acutely sensitive to temperature — even modest climate warming pushes it toward heat stress and forces population decline. It is the critical link between the beetle and hawk trophic levels.',
    traits: ['Near-perfect camouflage (92)', 'Extreme heat sensitivity', 'Ambush hunter'],
    concepts: ['Camouflage', 'Trophic Levels', 'Climate Sensitivity', 'Adaptation'],
  },
  {
    id: 'hawk',
    emoji: '🦅',
    name: 'Island Hawk',
    trophic: 'Apex Predator',
    trophicColor: '#b85858',
    description:
      'The island\'s apex predator — combining the highest speed (95) and strength (92) of any species. Hawks hunt deer and frogs from altitude, diving at steep angles to strike with powerful talons. Because energy is lost at each trophic level (roughly 90% is never transferred), the hawk population must stay tiny to survive. Losing even a few individuals can cause the population to collapse entirely.',
    traits: ['Highest speed + strength', 'Tiny population (8)', 'Top of food chain'],
    concepts: ['Apex Predators', 'Energy Flow', '10% Rule', 'Trophic Levels'],
  },
  {
    id: 'fungi',
    emoji: '🍄',
    name: 'Shelf Fungi',
    trophic: 'Decomposer',
    trophicColor: '#7a6858',
    description:
      'A wood-rotting fungus that colonises dead trees and fallen logs, breaking complex organic molecules back into soil nutrients. Its mycelium network spreads invisibly underground — even if the visible fruiting body is removed, the organism persists and re-emerges. Without decomposers, dead organic matter would pile up and nutrients would never re-enter the cycle, eventually starving every producer on the island.',
    traits: ['Nearly indestructible (resilience 94)', 'Invisible underground network', 'Nutrient recycler'],
    concepts: ['Decomposers', 'Nutrient Cycling', 'Matter & Energy Flow', 'Symbiosis'],
  },
]

const TROPHIC_ORDER = ['Producer', 'Perennial Producer', 'Primary Consumer', 'Secondary Consumer', 'Apex Predator', 'Decomposer']

export default function AnimalsPanel() {
  const [open, setOpen] = useState(null)

  return (
    <div className="animals-panel">
      <div className="animals-panel__header">
        <span className="section-label">Island Species</span>
        <span className="animals-panel__count">{ANIMALS.length} species</span>
      </div>

      {ANIMALS.map(a => {
        const isOpen = open === a.id
        return (
          <div key={a.id} className={`animal-card ${isOpen ? 'animal-card--open' : ''}`}>
            {/* Summary row — always visible */}
            <button
              className="animal-card__row"
              onClick={() => setOpen(isOpen ? null : a.id)}
            >
              <span className="animal-card__emoji">{a.emoji}</span>
              <div className="animal-card__info">
                <span className="animal-card__name">{a.name}</span>
                <span
                  className="animal-card__trophic"
                  style={{ color: a.trophicColor }}
                >
                  {a.trophic}
                </span>
              </div>
              <span className="animal-card__chevron">{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Detail section */}
            {isOpen && (
              <div className="animal-card__detail">
                <p className="animal-card__desc">{a.description}</p>

                {a.special && (
                  <div className="animal-card__special">
                    ♻ {a.special}
                  </div>
                )}

                <div className="animal-card__traits">
                  {a.traits.map(t => (
                    <span key={t} className="animal-trait">{t}</span>
                  ))}
                </div>

                <div className="animal-card__concepts">
                  {a.concepts.map(c => (
                    <span key={c} className="concept-badge">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
