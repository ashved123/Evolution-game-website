import React, { useState } from 'react'
import { SPECIES } from '../data/species.js'
import { SPRITE_ICONS } from '../utils/spriteIcons.js'
import './InterventionPanel.css'

const SPECIES_META = Object.fromEntries(SPECIES.map(s => [s.id, s]))

const TROPHIC_ORDER = ['grass', 'tree', 'fungi', 'beetle', 'deer', 'frog', 'boar', 'monitor', 'hawk']

export default function InterventionPanel({ pops = {}, arrivedSpecies, deadMatter = 0, introduceCost = {}, onIntroduce, onCull }) {
  const [counts, setCounts] = useState({})
  const [flash,  setFlash]  = useState({})  // { spId: 'intro'|'cull' }

  function getCount(spId) { return counts[spId] ?? 1 }
  function setCount(spId, v) { setCounts(prev => ({ ...prev, [spId]: v })) }

  function doIntroduce(spId) {
    const n = getCount(spId)
    const result = onIntroduce?.(spId, n)
    if (result?.cost != null) {
      setFlash(prev => ({ ...prev, [spId]: 'intro' }))
      setTimeout(() => setFlash(prev => ({ ...prev, [spId]: null })), 1400)
    }
  }

  function doCull(spId) {
    const n = getCount(spId)
    onCull?.(spId, n)
    setFlash(prev => ({ ...prev, [spId]: 'cull' }))
    setTimeout(() => setFlash(prev => ({ ...prev, [spId]: null })), 1400)
  }

  const arrived = TROPHIC_ORDER.filter(id => arrivedSpecies?.has(id))

  return (
    <div className="ivp">

      <div className="ivp__header">
        <span className="section-label">Interventions</span>
        <div className="ivp__badges">
          <span className="concept-badge">Population Control</span>
          <span className="concept-badge">Conservation</span>
        </div>
      </div>

      <div className="ivp__biomatter">
        <span className="ivp__bm-label">Dead Matter</span>
        <div className="ivp__bm-bar-wrap">
          <div className="ivp__bm-bar" style={{ width: `${Math.min(100, (deadMatter / 600) * 100)}%` }} />
        </div>
        <span className="ivp__bm-val">{Math.round(deadMatter)}</span>
        <span className="concept-badge">Biomatter Budget</span>
      </div>

      <div className="ivp__note">
        Introduce individuals by spending dead matter. Cull removes individuals and returns 50% as dead matter.
      </div>

      <div className="ivp__rows">
        {arrived.map(spId => {
          const sp      = SPECIES_META[spId]
          if (!sp) return null
          const pop     = Math.round(pops[spId] ?? 0)
          const cost    = introduceCost[spId] ?? 20
          const n       = getCount(spId)
          const total   = cost * n
          const canAfford = deadMatter >= total
          const canCull   = pop >= n
          const extinct   = pop < 1
          const f         = flash[spId]
          const maxN      = Math.min(10, Math.max(1, Math.round(pop * 0.3) || 1))

          return (
            <div key={spId} className={`ivp__row ${extinct ? 'ivp__row--extinct' : ''}`}>
              <div className="ivp__row-info">
                <img src={SPRITE_ICONS[spId]} className="ivp__emoji" style={{ imageRendering: 'pixelated' }} alt={spId} />
                <span className="ivp__name">{sp.name}</span>
                <span className={`ivp__pop ${extinct ? 'ivp__pop--extinct' : ''}`}>
                  {extinct ? 'EXTINCT' : pop}
                </span>
              </div>

              <div className="ivp__controls">
                <input
                  type="range" min={1} max={Math.max(1, extinct ? 10 : maxN)}
                  value={Math.min(n, Math.max(1, extinct ? 10 : maxN))}
                  onChange={e => setCount(spId, Number(e.target.value))}
                  className="ivp__slider"
                />
                <span className="ivp__n">×{n}</span>

                <button
                  className={`pixel-btn ivp__btn ivp__btn--intro ${f === 'intro' ? 'ivp__btn--flash' : ''} ${!canAfford ? 'ivp__btn--disabled' : ''}`}
                  onClick={() => canAfford && doIntroduce(spId)}
                  title={`Introduce ${n} — costs ${total} dead matter`}
                >
                  {f === 'intro' ? '✓' : `+${n}`}
                  <span className="ivp__cost">{total}</span>
                </button>

                <button
                  className={`pixel-btn ivp__btn ivp__btn--cull ${f === 'cull' ? 'ivp__btn--flash' : ''} ${!canCull ? 'ivp__btn--disabled' : ''}`}
                  onClick={() => canCull && doCull(spId)}
                  title={`Cull ${n} — refunds ${Math.floor(cost * n * 0.5)} dead matter`}
                >
                  {f === 'cull' ? '✓' : `-${n}`}
                  <span className="ivp__refund">+{Math.floor(cost * n * 0.5)}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
