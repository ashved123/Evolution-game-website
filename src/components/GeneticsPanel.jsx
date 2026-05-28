import React from 'react'
import { SPECIES } from '../data/species.js'
import { STAT_GROUPS } from '../data/codons.js'
import './GeneticsPanel.css'

const STAT_LABEL = Object.fromEntries(
  STAT_GROUPS.flatMap(g => g.stats).map(s => [s.key, s.label])
)

const SPECIES_META = Object.fromEntries(SPECIES.map(s => [s.id, s]))

// Frequency line chart as SVG
function FreqChart({ values, width = 200, height = 48 }) {
  if (!values || values.length < 2) {
    return <div className="gp-chart-empty" style={{ width, height }}>waiting for data…</div>
  }
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - (v / 100) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  // Colour based on recent trend
  const recent = values.slice(-6)
  const trend  = recent[recent.length - 1] - recent[0]
  const lineColor = trend > 2 ? '#66bb6a' : trend < -2 ? '#ef5350' : '#a09080'

  return (
    <svg width={width} height={height} className="gp-freq-chart">
      {/* Reference lines */}
      {[25, 50, 75].map(pct => {
        const y = height - (pct / 100) * height
        return <line key={pct} x1={0} y1={y} x2={width} y2={y}
          stroke="rgba(120,90,60,0.2)" strokeWidth={0.5} strokeDasharray="3,3" />
      })}
      <line x1={0} y1={height} x2={width} y2={height} stroke="rgba(120,90,60,0.3)" strokeWidth={0.5} />
      <polyline points={pts.join(' ')} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
      {/* Current value dot */}
      {(() => {
        const last = values[values.length - 1]
        const x = width
        const y = height - (last / 100) * height
        return <circle cx={x} cy={y} r={3} fill={lineColor} />
      })()}
      {/* Y labels */}
      <text x={2} y={height - (75/100)*height - 2} fontSize={5} fill="rgba(120,90,60,0.5)">75%</text>
      <text x={2} y={height - (50/100)*height - 2} fontSize={5} fill="rgba(120,90,60,0.5)">50%</text>
      <text x={2} y={height - (25/100)*height - 2} fontSize={5} fill="rgba(120,90,60,0.5)">25%</text>
    </svg>
  )
}

function trendLabel(values) {
  if (!values || values.length < 4) return { text: 'tracking…', cls: '' }
  const recent = values.slice(-6)
  const diff = recent[recent.length - 1] - recent[0]
  if (diff > 4)  return { text: '↑ spreading', cls: 'gp-trend--up' }
  if (diff < -4) return { text: '↓ declining', cls: 'gp-trend--down' }
  return { text: '→ stable',  cls: 'gp-trend--flat' }
}

export default function GeneticsPanel({ mutationRegistry = {}, mutationFreqHistory = {}, pops = {}, highlightMutationId, onHighlight }) {
  const mutations = Object.values(mutationRegistry).sort((a, b) => b.tick - a.tick)

  return (
    <div className="genetics-panel">

      <div className="gp-header">
        <span className="section-label">Genetics</span>
        <span className="concept-badge">Allele Frequency</span>
        <span className="concept-badge">Natural Selection</span>
        <span className="concept-badge">Hardy-Weinberg</span>
      </div>

      {mutations.length === 0 ? (
        <div className="gp-empty-state">
          <p>No mutations injected yet.</p>
          <p>Use the Gene Lab to design a mutation and inject it into individuals. Once injected, you can track how it spreads (or dies out) through the population here.</p>
        </div>
      ) : (
        <div className="gp-mutations">
          {mutations.map(meta => {
            const sp       = SPECIES_META[meta.spId]
            const freqVals = mutationFreqHistory[meta.mutId] ?? []
            const current  = freqVals.length ? freqVals[freqVals.length - 1] : null
            const trend    = trendLabel(freqVals)
            const isHighlit = highlightMutationId === meta.mutId
            const traitLines = Object.entries(meta.deltas)
              .filter(([, d]) => d !== 0)
              .map(([key, d]) => `${STAT_LABEL[key] ?? key} ${d > 0 ? '+' : ''}${d}`)
              .join('  ·  ')

            return (
              <div key={meta.mutId} className={`gp-mut-card ${isHighlit ? 'gp-mut-card--highlighted' : ''}`}>

                <div className="gp-mut-card__head">
                  <span className="gp-mut-card__species">{sp?.emoji} {sp?.name}</span>
                  <span className="gp-mut-card__tick">tick {meta.tick}</span>
                </div>

                <div className="gp-mut-card__traits">{traitLines}</div>

                <div className="gp-mut-card__body">
                  <div className="gp-mut-card__chart-wrap">
                    <FreqChart values={freqVals} width={180} height={52} />
                  </div>

                  <div className="gp-mut-card__stats">
                    {current !== null ? (
                      <span className="gp-mut-card__freq">{current}%</span>
                    ) : (
                      <span className="gp-mut-card__freq gp-mut-card__freq--pending">—</span>
                    )}
                    <span className={`gp-trend ${trend.cls}`}>{trend.text}</span>
                    <span className="gp-mut-card__injected">
                      injected into {meta.count} of {Math.round(pops[meta.spId] ?? 0)} individuals
                    </span>

                    <button
                      className={`pixel-btn gp-highlight-btn ${isHighlit ? 'gp-highlight-btn--active' : ''}`}
                      onClick={() => onHighlight?.(isHighlit ? null : meta.mutId)}
                      title={isHighlit ? 'Stop highlighting' : 'Show carriers on map'}
                    >
                      {isHighlit ? '● On map' : '○ Show on map'}
                    </button>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
