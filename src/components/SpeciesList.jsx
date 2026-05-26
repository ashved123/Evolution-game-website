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

export default function SpeciesList({ pops, dnaOverrides, onSelectSpecies, selectedSpecies, individuals = {} }) {
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
          const currentDna  = dnaOverrides?.[sp.id] ?? sp.dna
          const resolvedBase = applyDNA(sp.stats, currentDna)
          const pool         = individuals[sp.id] ?? []
          // Show average stats across living individuals; falls back to DNA-resolved if no pool
          const displayStats = averageStats(pool, resolvedBase)
          const fit          = overallFitness(displayStats)
          const livePop      = pops?.[sp.id] ?? sp.pop
          const isOpen       = expandedId === sp.id
          const extinct      = livePop < 1

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
