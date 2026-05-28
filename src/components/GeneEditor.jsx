import React, { useState, useMemo } from 'react'
import { CODONS, STAT_GROUPS, NEUTRAL_CODONS, applyDNA } from '../data/codons.js'
import { LIFESPAN, BREED_COOLDOWN, HUNGER_RATE } from '../simulation/agentConfig.js'
import { TICKS_PER_YEAR } from '../simulation/engine.js'
import './GeneEditor.css'

const BASES = ['A', 'T', 'G', 'C']

function phenotype(spId, stats) {
  const speed        = stats.speed        ?? 0
  const constitution = stats.constitution ?? 50
  const fertility    = stats.fertility    ?? 50
  const metabolism   = stats.metabolism   ?? 50
  const camouflage   = stats.camouflage   ?? 0
  const reasoning    = stats.reasoning    ?? 0
  const strength     = stats.strength     ?? 0
  const heatTol      = stats.heatTolerance ?? 0

  const baseLifespan   = LIFESPAN[spId] ?? 72000
  const lifespanFrames = baseLifespan * (0.5 + constitution / 100)
  const lifespanYears  = (lifespanFrames / 60 / TICKS_PER_YEAR).toFixed(1)

  const cooldownFrames = BREED_COOLDOWN * (1.5 - fertility / 100)
  const cooldownTicks  = Math.round(cooldownFrames / (60 / TICKS_PER_YEAR * TICKS_PER_YEAR))

  const metabScale  = 0.6 + metabolism / 250
  const baseHunger  = HUNGER_RATE[spId] ?? 0.008
  const drainPerSec = (baseHunger * metabScale * 60).toFixed(3)

  const detectionPct = Math.round((1 - camouflage / 200) * 100)

  return {
    speed:         `${((speed / 100) * 6).toFixed(1)} units/frame`,
    strength:      `Seed radius ×${(0.5 + strength / 200).toFixed(2)}`,
    constitution:  `~${lifespanYears} yr lifespan`,
    resilience:    `Death rate ×${(1.4 - (stats.resilience ?? 50) / 125).toFixed(2)}`,
    heatTolerance: `${heatTol}% thermal buffer`,
    reasoning:     `${Math.round((1 - reasoning / 100) * 100)}% random walk`,
    camouflage:    `${detectionPct}% detectable to predators`,
    metabolism:    `${drainPerSec} hunger/sec`,
    fertility:     `Breeds every ~${cooldownTicks} frames`,
  }
}

// Compute stat deltas introduced by the current DNA vs the species default DNA
function computeDeltas(speciesDna, currentDna) {
  const deltas = {}
  const allKeys = new Set([...Object.keys(speciesDna ?? {}), ...Object.keys(currentDna ?? {})])
  for (const key of allKeys) {
    const originalMod = (speciesDna?.[key] ?? NEUTRAL_CODONS).reduce((s, c) => s + (CODONS[c]?.modifier ?? 0), 0)
    const currentMod  = (currentDna?.[key]  ?? NEUTRAL_CODONS).reduce((s, c) => s + (CODONS[c]?.modifier ?? 0), 0)
    const d = currentMod - originalMod
    if (d !== 0) deltas[key] = d
  }
  return deltas
}

// editing state: { statKey, codonIdx, baseIdx } or null
export default function GeneEditor({ species, dna: dnaProp, onDnaChange, onClose, livePop = 0, onInjectMutation }) {
  const dna = dnaProp ?? species?.dna ?? {}
  const [editing,      setEditing]      = useState(null)
  const [injectCount,  setInjectCount]  = useState(1)
  const [injectFlash,  setInjectFlash]  = useState(false)

  React.useEffect(() => { setEditing(null); setInjectFlash(false) }, [species?.id])

  if (!species) return null

  const computedStats = applyDNA(species.stats, dna)
  const derived       = phenotype(species.id, computedStats)

  // Deltas introduced by current DNA vs original species DNA
  const deltas = useMemo(() => computeDeltas(species.dna, dna), [species.dna, dna])
  const hasDeltas = Object.keys(deltas).length > 0
  const maxCount  = Math.max(1, Math.min(10, livePop))

  function applyBase(newBase) {
    const { statKey, codonIdx, baseIdx } = editing
    const traitCodons = [...(dna[statKey] ?? NEUTRAL_CODONS)]
    const codonChars  = traitCodons[codonIdx].split('')
    codonChars[baseIdx] = newBase
    traitCodons[codonIdx] = codonChars.join('')
    onDnaChange?.({ ...dna, [statKey]: traitCodons })
    setEditing(null)
  }

  function handleInject() {
    if (!hasDeltas || !onInjectMutation) return
    const n = onInjectMutation(deltas, injectCount)
    if (n > 0) {
      setInjectFlash(true)
      setTimeout(() => setInjectFlash(false), 2000)
    }
  }

  return (
    <div className="gene-editor">

      <div className="gene-editor__header">
        <span className="gene-editor__species">{species.emoji} {species.name}</span>
        <div className="gene-editor__badges">
          <span className="concept-badge">DNA Base Pairs</span>
          <span className="concept-badge">Codons</span>
          <span className="concept-badge">Point Mutation</span>
        </div>
        <button className="pixel-btn pixel-btn--outline ge-close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="gene-editor__body">
        {STAT_GROUPS.map(group => (
          <div key={group.label} className="ge-trait-group">
            <div className="ge-trait-group__label">{group.label}</div>

            {group.stats.map(({ key, label, color, desc }) => {
              const traitCodons = dna[key] ?? NEUTRAL_CODONS
              const base        = species.stats[key] ?? 0
              const current     = computedStats[key] ?? 0
              const delta       = current - base

              return (
                <div key={key} className="ge-trait-row">

                  <div className="ge-trait-row__info">
                    <div className="ge-trait-row__top">
                      <span className="ge-trait-row__label" style={{ color }}>{label}</span>
                      <span className="ge-trait-row__val">{current}</span>
                      {delta !== 0 && (
                        <span className={`ge-trait-row__delta ${delta > 0 ? 'delta--pos' : 'delta--neg'}`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </div>
                    <div className="stat-bar">
                      <div className="stat-bar__fill" style={{ width: `${current}%`, background: color }} />
                    </div>
                    <div className="ge-trait-row__phenotype">{derived[key]}</div>
                  </div>

                  <div className="ge-trait-codons">
                    {traitCodons.map((codon, ci) => {
                      const codonDef = CODONS[codon]
                      const mod      = codonDef?.modifier ?? 0
                      return (
                        <React.Fragment key={ci}>
                          <div className={`codon ${mod !== 0 ? 'codon--active' : ''}`}>
                            <div className="codon__bases">
                              {codon.split('').map((base, bi) => {
                                const isActive = editing?.statKey === key && editing?.codonIdx === ci && editing?.baseIdx === bi
                                return (
                                  <button
                                    key={bi}
                                    className={`base-btn base-btn--${base} ${isActive ? 'base-btn--editing' : ''}`}
                                    onClick={() => setEditing(isActive ? null : { statKey: key, codonIdx: ci, baseIdx: bi })}
                                  >
                                    {base}
                                  </button>
                                )
                              })}
                            </div>
                            <div className="codon__label">{codonDef?.label ?? '???'}</div>
                            {mod !== 0 && (
                              <span className={`codon__mod ${mod > 0 ? 'eff--pos' : 'eff--neg'}`}>
                                {mod > 0 ? `+${mod}` : mod}
                              </span>
                            )}
                          </div>
                          {ci < traitCodons.length - 1 && <span className="codon-sep">·</span>}
                        </React.Fragment>
                      )
                    })}
                  </div>

                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Base picker */}
      {editing ? (
        <div className="ge-picker-bar">
          <span className="base-picker__label">Mutate to:</span>
          {BASES.map(b => (
            <button key={b} className={`base-btn base-btn--${b}`} onClick={() => applyBase(b)}>{b}</button>
          ))}
          <button className="pixel-btn pixel-btn--outline ge-close-btn" onClick={() => setEditing(null)}>✕</button>
        </div>
      ) : (
        <p className="ge-hint">Click any base to design a mutation, then inject it below</p>
      )}

      {/* ── Inject panel ── */}
      <div className={`ge-inject ${hasDeltas ? 'ge-inject--ready' : ''}`}>
        <div className="ge-inject__header">
          <span className="concept-badge">Natural Selection</span>
          <span className="ge-inject__title">Inject into Population</span>
        </div>

        {hasDeltas ? (
          <>
            <div className="ge-inject__deltas">
              {Object.entries(deltas).map(([key, d]) => (
                <span key={key} className={`ge-inject__delta-chip ${d > 0 ? 'delta--pos' : 'delta--neg'}`}>
                  {key} {d > 0 ? `+${d}` : d}
                </span>
              ))}
            </div>

            <div className="ge-inject__controls">
              <label className="ge-inject__count-label">
                Individuals:
                <input
                  type="range"
                  min={1}
                  max={maxCount}
                  value={Math.min(injectCount, maxCount)}
                  onChange={e => setInjectCount(Number(e.target.value))}
                  className="ge-inject__slider"
                />
                <span className="ge-inject__count-val">{Math.min(injectCount, maxCount)} / {livePop}</span>
              </label>

              <button
                className={`pixel-btn ge-inject__btn ${injectFlash ? 'ge-inject__btn--done' : ''}`}
                onClick={handleInject}
                disabled={injectFlash}
              >
                {injectFlash ? 'Injected!' : 'Inject Mutation'}
              </button>
            </div>
          </>
        ) : (
          <p className="ge-inject__hint">Edit codons above to design a mutation, then inject it into selected individuals. Their offspring will inherit the change.</p>
        )}
      </div>

    </div>
  )
}
