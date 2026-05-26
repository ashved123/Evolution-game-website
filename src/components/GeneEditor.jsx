import React, { useState } from 'react'
import { CODONS, STAT_META, applyDNA } from '../data/codons.js'
import './GeneEditor.css'

const BASES = ['A', 'T', 'G', 'C']

// dna and onDnaChange are now controlled from App — gene edits affect the live simulation
export default function GeneEditor({ species, dna: dnaProp, onDnaChange, onClose }) {
  const dna = dnaProp ?? species?.dna ?? ['ATG', 'GCC', 'TAA']
  const [editing, setEditing] = useState(null) // { codonIdx, baseIdx }

  React.useEffect(() => { setEditing(null) }, [species?.id])

  if (!species) return null

  const computedStats = applyDNA(species.stats, dna)

  function applyBase(newBase) {
    const { codonIdx, baseIdx } = editing
    const newDna = dna.map((codon, ci) => {
      if (ci !== codonIdx) return codon
      const arr = codon.split('')
      arr[baseIdx] = newBase
      return arr.join('')
    })
    onDnaChange?.(newDna)
    setEditing(null)
  }

  return (
    <div className="gene-editor">
      {/* Header */}
      <div className="gene-editor__header">
        <span className="gene-editor__species">{species.emoji} {species.name}</span>
        <div className="gene-editor__badges">
          <span className="concept-badge">DNA Base Pairs</span>
          <span className="concept-badge">Codons</span>
          <span className="concept-badge">Point Mutation</span>
        </div>
        <button className="pixel-btn pixel-btn--outline ge-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Body: DNA left | Stats right */}
      <div className="gene-editor__body">

        {/* ── DNA column ── */}
        <div className="ge-dna-col">
          <div className="dna-strip">
            {dna.map((codon, ci) => (
              <React.Fragment key={ci}>
                <div className="codon">
                  <div className="codon__bases">
                    {codon.split('').map((base, bi) => {
                      const isActive = editing?.codonIdx === ci && editing?.baseIdx === bi
                      return (
                        <button
                          key={bi}
                          className={`base-btn base-btn--${base} ${isActive ? 'base-btn--editing' : ''}`}
                          onClick={() => setEditing(isActive ? null : { codonIdx: ci, baseIdx: bi })}
                        >
                          {base}
                        </button>
                      )
                    })}
                  </div>
                  <div className="codon__label">{CODONS[codon]?.label ?? '???'}</div>
                </div>
                {ci < dna.length - 1 && <span className="codon-sep">·</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Base picker */}
          {editing ? (
            <div className="base-picker">
              <span className="base-picker__label">Mutate to:</span>
              {BASES.map(b => (
                <button
                  key={b}
                  className={`base-btn base-btn--${b}`}
                  onClick={() => applyBase(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          ) : (
            <p className="ge-hint">Click any base to mutate it</p>
          )}
        </div>

        {/* ── Stats column ── */}
        <div className="ge-stats-col">
          {STAT_META.map(({ key, label, color }) => {
            const base = species.stats[key] ?? 0
            const current = computedStats[key] ?? 0
            const delta = current - base
            return (
              <div key={key} className="stat-row">
                <span className="stat-row__label">{label}</span>
                <div className="stat-bar">
                  <div
                    className="stat-bar__fill"
                    style={{ width: `${current}%`, background: color }}
                  />
                </div>
                <span className="stat-row__val">{current}</span>
                {delta !== 0 && (
                  <span className={`stat-row__delta ${delta > 0 ? 'delta--pos' : 'delta--neg'}`}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
