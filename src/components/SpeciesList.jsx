import React, { useState } from 'react'
import { SPECIES, overallFitness } from '../data/species.js'
import { STAT_META, applyDNA } from '../data/codons.js'
import { averageStats } from '../simulation/individuals.js'
import './SpeciesList.css'

function fitColor(f) {
  if (f >= 70) return '#4caf50'
  if (f >= 40) return '#ffb74d'
  return '#ef5350'
}

const SPECIES_INFO = {
  grass: {
    description: 'The foundation of the entire food web. Island Grass spreads rapidly through underground runners and wind-dispersed seeds. Its shallow roots make it vulnerable to drought and overgrazing — when herbivore populations spike, grass coverage collapses, triggering a cascade of starvation through every trophic level.',
    traits: ['High heat tolerance', 'Fast regrowth', 'Vulnerable to overgrazing'],
    concepts: ['Primary Producer', 'Autotroph', 'Limiting Factor'],
  },
  tree: {
    description: 'A slow-growing fig tree that provides a permanent, renewable food source. Unlike grass it cannot be overgrazed — it continuously drops fruit and regenerates leaves. Its deep roots and thick bark give it extraordinary resilience against drought, fire, and disease.',
    traits: ['Renewable food source', 'Fire resistant', 'Immobile', 'Long-lived'],
    concepts: ['Perennial Producer', 'Renewable Resource', 'Resilience'],
    special: 'Fruit regenerates indefinitely — population never reaches zero.',
  },
  beetle: {
    description: 'A heavily armoured herbivore with a dense chitinous exoskeleton that resists both predation and water loss. Rock Beetles are slow but nearly impossible for frogs to swallow. They graze on grass and fallen figs, and their populations explode when predator numbers fall.',
    traits: ['Armoured exoskeleton', 'Cryptic rock colouring', 'Slow but durable'],
    concepts: ['Adaptation', 'Natural Selection', 'Primary Consumer'],
  },
  deer: {
    description: "A small, skittish herbivore whose only defence is explosive speed. The Leaf Deer's physiology is optimised for flight — lightweight frame, powerful hindquarters, near-360° vision. Very vulnerable to injury and disease. As a key prey species for the hawk, deer numbers directly control apex predator health.",
    traits: ['Fastest land animal (speed 85)', 'Very low resilience', 'Key prey species'],
    concepts: ['Predator-Prey Dynamics', 'Adaptation', 'Fitness'],
  },
  frog: {
    description: 'A sit-and-wait ambush predator with the best camouflage on the island (92). The Marsh Frog lies motionless among leaf litter then strikes beetles with a projectile tongue. Its skin must stay moist, making it acutely sensitive to heat — climate warming pushes it toward population decline.',
    traits: ['Near-perfect camouflage (92)', 'Extreme heat sensitivity', 'Ambush hunter'],
    concepts: ['Camouflage', 'Trophic Levels', 'Climate Sensitivity'],
  },
  boar: {
    description: "An omnivore with powerful tusks and a dense hide. Wild Boar root through soil for beetles and grubs, strip bark, and graze — competing with deer and beetle for resources. Their generalist diet makes them highly resilient to food shortages that would collapse specialist herbivores.",
    traits: ['Omnivore', 'High strength (80)', 'Generalist diet'],
    concepts: ['Omnivory', 'Competitive Exclusion', 'Resilience'],
  },
  monitor: {
    description: 'An ectotherm ambush predator that relies on the sun to maintain body temperature. Monitor Lizards patrol wetland margins and forest edges, ambushing frogs and beetles with a powerful jaw. Their metabolic efficiency lets them survive long periods without food.',
    traits: ['Ectotherm (sun dependent)', 'Ambush strategy', 'Wetland specialist'],
    concepts: ['Ectothermy', 'Secondary Predator', 'Biome Specialisation'],
  },
  hawk: {
    description: "The island's apex predator — combining the highest speed (95) and strength (92). Hawks hunt deer and frogs from altitude, diving at steep angles to strike with powerful talons. Because ~90% of energy is lost at each trophic level, the hawk population must stay tiny to survive.",
    traits: ['Highest speed + strength', 'Tiny population', 'Top of food chain'],
    concepts: ['Apex Predator', 'Energy Flow', '10% Rule'],
  },
  fungi: {
    description: 'A wood-rotting fungus that colonises dead trees and fallen logs, breaking complex organic molecules back into soil nutrients. Its mycelium network spreads invisibly underground. Without decomposers, dead organic matter would accumulate and nutrients would never re-enter the cycle.',
    traits: ['Nearly indestructible (resilience 94)', 'Underground network', 'Nutrient recycler'],
    concepts: ['Decomposer', 'Nutrient Cycling', 'Matter & Energy Flow'],
  },
}

export default function SpeciesList({ pops, dnaOverrides, onSelectSpecies, selectedSpecies, individuals = {}, arrivedSpecies }) {
  const [expandedId, setExpandedId] = useState(null)

  const visibleSpecies = arrivedSpecies
    ? SPECIES.filter(s => arrivedSpecies.has(s.id))
    : SPECIES

  function toggle(sp) {
    setExpandedId(prev => prev === sp.id ? null : sp.id)
  }

  return (
    <div className="species-list">
      <div className="species-list__header">
        <span className="section-label">Species</span>
        <span className="concept-badge">Fitness</span>
        <span className="concept-badge">Natural Selection</span>
      </div>
      <div className="species-list__rows">
        {visibleSpecies.map(sp => {
          const currentDna   = dnaOverrides?.[sp.id] ?? sp.dna
          const resolvedBase = applyDNA(sp.stats, currentDna)
          const pool         = individuals[sp.id] ?? []
          const displayStats = averageStats(pool, resolvedBase)
          const fit          = overallFitness(displayStats)
          const livePop      = pops?.[sp.id] ?? sp.pop
          const isOpen       = expandedId === sp.id
          const extinct      = livePop < 1
          const info         = SPECIES_INFO[sp.id]

          return (
            <div key={sp.id} className={`species-item ${extinct ? 'species-item--extinct' : ''}`}>
              <button
                className={`species-row ${selectedSpecies?.id === sp.id ? 'species-row--selected' : ''}`}
                onClick={() => toggle(sp)}
              >
                <span className="species-row__emoji" style={{ opacity: extinct ? 0.35 : 1 }}>{sp.emoji}</span>
                <div className="species-row__info">
                  <span className="species-row__name">{sp.name}{extinct ? ' — EXTINCT' : ''}</span>
                  <span className="species-row__trophic">{sp.trophic}</span>
                  <div className="fitness-bar">
                    <div className="fitness-bar__fill" style={{ width: `${fit}%`, background: fitColor(fit) }} />
                  </div>
                </div>
                <div className="species-row__stats">
                  <span className="species-row__pop">{Math.round(livePop)}</span>
                  <span className="species-row__pop-label">pop</span>
                  <span className="species-row__fit" style={{ color: fitColor(fit) }}>{fit}</span>
                  <span className="species-row__fit-label">fit</span>
                </div>
                <span className="species-row__chevron">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="species-stats-panel">

                  {/* Description */}
                  {info && (
                    <div className="ssp-desc-block">
                      <p className="ssp-desc">{info.description}</p>
                      {info.special && <p className="ssp-special">♻ {info.special}</p>}
                      <div className="ssp-traits">
                        {info.traits.map(t => <span key={t} className="ssp-trait">{t}</span>)}
                      </div>
                      <div className="ssp-concepts">
                        {info.concepts.map(c => <span key={c} className="concept-badge">{c}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Stat bars */}
                  <div className="ssp-avg-label">Population average ({pool.length} individuals)</div>
                  {STAT_META.map(({ key, label, color }) => {
                    const avg  = displayStats[key] ?? 0
                    const base = resolvedBase[key] ?? 0
                    const diff = avg - base
                    return (
                      <div key={key} className="ssp-row">
                        <span className="ssp-label">{label}</span>
                        <div className="ssp-bar">
                          <div className="ssp-bar__fill" style={{ width: `${avg}%`, background: color }} />
                        </div>
                        <span className="ssp-val">{avg}</span>
                        <span className={`ssp-diff ${diff > 0 ? 'ssp-diff--pos' : diff < 0 ? 'ssp-diff--neg' : ''}`}>
                          {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : ''}
                        </span>
                      </div>
                    )
                  })}

                  <button className="pixel-btn ssp-dna-btn" onClick={() => onSelectSpecies(sp)}>
                    Edit DNA
                  </button>

                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
