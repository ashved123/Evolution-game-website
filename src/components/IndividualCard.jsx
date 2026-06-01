import React from 'react'
import { STAT_META } from '../data/codons.js'
import { effectiveStats } from '../simulation/individuals.js'
import { overallFitness } from '../data/species.js'
import { LIFESPAN } from '../simulation/agentConfig.js'
import { SPRITE_ICONS } from '../utils/spriteIcons.js'
import './IndividualCard.css'

const CARD_W = 230
const CARD_H = 340

const STATE_LABEL = { wander: '🚶 Wandering', flee: '💨 Fleeing', hunt: '🎯 Hunting', eat: '🍽 Eating' }

export default function IndividualCard({ species, individual, resolvedBase, idx, cssX, cssY, canvasW = 800, canvasH = 600, onClose }) {
  if (!individual || !species) return null
  const stats   = effectiveStats(resolvedBase, individual.variation)
  const fitness = overallFitness(stats)

  // Flip card left/up if it would overflow the canvas
  const flipX = cssX + 16 + CARD_W > canvasW
  const flipY = cssY + 16 + CARD_H > canvasH
  const style = {
    left: flipX ? cssX - CARD_W - 8 : cssX + 16,
    top:  flipY ? cssY - CARD_H - 8 : cssY + 16,
  }

  const lifespan   = LIFESPAN[species.id] ?? null
  const agePct     = lifespan ? Math.round((individual.age / lifespan) * 100) : null
  const hungerPct  = individual.hunger != null ? Math.round(individual.hunger) : null
  const stateLabel = individual.state ? (STATE_LABEL[individual.state] ?? individual.state) : null

  return (
    <div className="ind-card" style={style}>
      <div className="ind-card__header">
        <img src={SPRITE_ICONS[species.id]} className="ind-card__emoji" style={{ imageRendering: 'pixelated' }} alt={species.id} />
        <div>
          <div className="ind-card__name">{species.name}</div>
          <div className="ind-card__sub">
            {species.trophic}
            {individual.gender === 'M' && <span className="ind-card__gender ind-card__gender--m"> ♂</span>}
            {individual.gender === 'F' && <span className="ind-card__gender ind-card__gender--f"> ♀</span>}
          </div>
        </div>
        <button className="ind-card__close" onClick={onClose}>✕</button>
      </div>

      {(stateLabel || hungerPct != null || agePct != null) && (
        <div className="ind-card__live">
          {stateLabel  && <span className="ind-card__live-item">{stateLabel}</span>}
          {hungerPct != null && (
            <span className="ind-card__live-item">
              🍖 Hunger
              <span className="ind-card__live-bar">
                <span className="ind-card__live-fill" style={{ width: `${hungerPct}%`, background: hungerPct > 40 ? '#66bb6a' : '#ef5350' }} />
              </span>
              {hungerPct}%
            </span>
          )}
          {agePct != null && (
            <span className="ind-card__live-item">
              ⏳ Age
              <span className="ind-card__live-bar">
                <span className="ind-card__live-fill" style={{ width: `${agePct}%`, background: '#ffb74d' }} />
              </span>
              {agePct}%
            </span>
          )}
        </div>
      )}

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
