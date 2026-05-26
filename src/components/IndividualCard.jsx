import React from 'react'
import { STAT_META } from '../data/codons.js'
import { effectiveStats } from '../simulation/individuals.js'
import { overallFitness } from '../data/species.js'
import './IndividualCard.css'

export default function IndividualCard({ species, individual, resolvedBase, idx, cssX, cssY, onClose }) {
  if (!individual || !species) return null
  const stats   = effectiveStats(resolvedBase, individual.variation)
  const fitness = overallFitness(stats)

  // Keep card on-screen: flip left if too close to right edge, flip up if near bottom
  const style = {
    left: cssX + 16,
    top:  cssY + 16,
  }

  return (
    <div className="ind-card" style={style}>
      <div className="ind-card__header">
        <span className="ind-card__emoji">{species.emoji}</span>
        <div>
          <div className="ind-card__name">{species.name}</div>
          <div className="ind-card__sub">
            Individual #{idx + 1}
            {individual.gender === 'M' && <span className="ind-card__gender ind-card__gender--m"> ♂</span>}
            {individual.gender === 'F' && <span className="ind-card__gender ind-card__gender--f"> ♀</span>}
          </div>
        </div>
        <button className="ind-card__close" onClick={onClose}>✕</button>
      </div>

      <div className="ind-card__stats">
        {STAT_META.map(({ key, label, color }) => {
          const val   = stats[key] ?? 0
          const base  = resolvedBase[key] ?? 0
          const delta = val - base
          return (
            <div key={key} className="ind-card__row">
              <span className="ind-card__label">{label}</span>
              <div className="ind-card__bar">
                <div className="ind-card__bar-fill" style={{ width: `${val}%`, background: color }} />
              </div>
              <span className="ind-card__val">{val}</span>
              <span className={`ind-card__delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero'}`}>
                {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="ind-card__footer">
        <span className="ind-card__fit-label">Fitness</span>
        <span className="ind-card__fit-val">{fitness}</span>
        <span className="ind-card__fit-label">/ 100</span>
      </div>
    </div>
  )
}
