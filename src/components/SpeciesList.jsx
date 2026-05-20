import React, { useState } from 'react'
import { SPECIES, overallFitness } from '../data/species.js'
import { STAT_META, applyDNA } from '../data/codons.js'
import './SpeciesList.css'

function fitColor(f) {
  if (f >= 70) return '#4caf50'
  if (f >= 40) return '#ffb74d'
  return '#ef5350'
}

export default function SpeciesList({ onSelectSpecies, selectedSpecies }) {
  const [expandedId, setExpandedId] = useState(null)

  function toggle(sp) {
    setExpandedId(prev => prev === sp.id ? null : sp.id)
  }

  return (
    <div className="species-list">
      <div className="species-list__header">
        <span className="section-label">Species</span>
        <span className="concept-badge">Fitness</span>
        <span className="concept-badge">Population</span>
      </div>
      <div className="species-list__rows">
        {SPECIES.map(sp => {
          const fit = overallFitness(sp.stats)
          const isOpen = expandedId === sp.id
          const computedStats = applyDNA(sp.stats, sp.dna)

          return (
            <div key={sp.id} className="species-item">
              <button
                className={`species-row ${selectedSpecies?.id === sp.id ? 'species-row--selected' : ''}`}
                onClick={() => toggle(sp)}
              >
                <span className="species-row__emoji">{sp.emoji}</span>
                <div className="species-row__info">
                  <span className="species-row__name">{sp.name}</span>
                  <span className="species-row__trophic">{sp.trophic}</span>
                  <div className="fitness-bar">
                    <div className="fitness-bar__fill" style={{ width: `${fit}%`, background: fitColor(fit) }} />
                  </div>
                </div>
                <div className="species-row__stats">
                  <span className="species-row__pop">{sp.pop}</span>
                  <span className="species-row__pop-label">pop</span>
                  <span className="species-row__fit" style={{ color: fitColor(fit) }}>{fit}</span>
                  <span className="species-row__fit-label">fit</span>
                </div>
                <span className="species-row__chevron">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="species-stats-panel">
                  {STAT_META.map(({ key, label, color }) => (
                    <div key={key} className="ssp-row">
                      <span className="ssp-label">{label}</span>
                      <div className="ssp-bar">
                        <div className="ssp-bar__fill" style={{ width: `${computedStats[key]}%`, background: color }} />
                      </div>
                      <span className="ssp-val">{computedStats[key]}</span>
                    </div>
                  ))}
                  <button
                    className="pixel-btn ssp-dna-btn"
                    onClick={() => onSelectSpecies(sp)}
                  >
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
