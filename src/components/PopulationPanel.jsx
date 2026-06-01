import React from 'react'
import { K } from '../simulation/engine.js'
import { CARRYING_CAPACITY } from '../simulation/agentConfig.js'
import { SPRITE_ICONS } from '../utils/spriteIcons.js'
import './PopulationPanel.css'

const ALL_K = { ...K, ...CARRYING_CAPACITY }

const SPECIES_META = [
  { id: 'grass',   name: 'Grass',    color: '#4caf50', group: 'producer'  },
  { id: 'tree',    name: 'Fig Tree', color: '#2e7d32', group: 'producer'  },
  { id: 'fungi',   name: 'Fungi',    color: '#ab47bc', group: 'producer'  },
  { id: 'beetle',  name: 'Beetle',   color: '#c46200', group: 'consumer'  },
  { id: 'deer',    name: 'Deer',     color: '#c8a070', group: 'consumer'  },
  { id: 'frog',    name: 'Frog',     color: '#00acc1', group: 'consumer'  },
  { id: 'boar',    name: 'Boar',     color: '#bf8a50', group: 'consumer'  },
  { id: 'monitor', name: 'Monitor',  color: '#5ca048', group: 'consumer'  },
  { id: 'hawk',    name: 'Hawk',     color: '#e85040', group: 'consumer'  },
]

// Multi-line SVG chart showing each species as % of its carrying capacity K.
// Y-axis: 0–130% of K. K reference line at 100%.
function PopChart({ popHistory, arrivedSpecies, group, height = 130 }) {
  const W = 420, H = height
  const ML = 34, MR = 8, MT = 8, MB = 16
  const plotW = W - ML - MR
  const plotH = H - MT - MB
  const MAX_Y_PCT = 130

  const visible = SPECIES_META.filter(s => s.group === group && arrivedSpecies?.has(s.id))

  if (visible.length === 0) {
    return (
      <div className="pp-chart-empty" style={{ height }}>
        waiting for species to arrive…
      </div>
    )
  }

  const maxLen = Math.max(2, ...visible.map(s => (popHistory[s.id] ?? []).length))

  function toY(pct) {
    return MT + plotH * (1 - Math.min(pct, MAX_Y_PCT) / MAX_Y_PCT)
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* Gridlines at 0%, 25%, 50%, 75%, 100% */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = toY(pct)
        return (
          <g key={pct}>
            <line
              x1={ML} y1={y} x2={ML + plotW} y2={y}
              stroke={pct === 100 ? 'rgba(120,90,60,0.4)' : 'rgba(120,90,60,0.13)'}
              strokeWidth={pct === 100 ? 0.8 : 0.5}
              strokeDasharray={pct === 100 ? '4,3' : ''}
            />
            <text x={ML - 3} y={y + 2} textAnchor="end" fontSize={6} fill="rgba(120,90,60,0.55)">
              {pct}%
            </text>
          </g>
        )
      })}

      {/* K label */}
      <text
        x={ML + plotW - 2} y={toY(100) - 3}
        textAnchor="end" fontSize={5} fill="rgba(120,90,60,0.5)"
      >
        K
      </text>

      {/* Population lines */}
      {visible.map(({ id, color }) => {
        const raw = popHistory[id] ?? []
        const kVal = ALL_K[id] ?? 1
        if (raw.length < 2) return null
        const pts = raw.map((v, i) => {
          const x = ML + (i / (maxLen - 1)) * plotW
          const pct = (v / kVal) * 100
          const y = toY(pct)
          return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        return (
          <polyline
            key={id}
            points={pts.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            opacity={0.9}
          />
        )
      })}

      {/* Current value dots */}
      {visible.map(({ id, color }) => {
        const raw = popHistory[id] ?? []
        if (!raw.length) return null
        const kVal = ALL_K[id] ?? 1
        const v = raw[raw.length - 1]
        const x = ML + plotW
        const y = toY((v / kVal) * 100)
        return <circle key={id} cx={x} cy={y} r={2.5} fill={color} />
      })}

      {/* X axis label */}
      <text
        x={ML + plotW / 2} y={H - 2}
        textAnchor="middle" fontSize={5} fill="rgba(120,90,60,0.4)"
      >
        time →
      </text>
    </svg>
  )
}

export default function PopulationPanel({ pops = {}, popHistory = {}, arrivedSpecies }) {
  const arrived = id => arrivedSpecies?.has(id)

  return (
    <div className="pop-panel">

      <div className="pop-panel__header">
        <span className="section-label">Population Dynamics</span>
        <div className="pop-panel__badges">
          <span className="concept-badge">Predator-Prey Cycles</span>
          <span className="concept-badge">Carrying Capacity</span>
          <span className="concept-badge">Logistic Growth</span>
        </div>
        <div className="pop-panel__note">
          Lines show population as % of carrying capacity K. Dashed line = K.
        </div>
      </div>

      {/* Producers & decomposer chart */}
      <div className="pp-chart-section">
        <div className="pp-chart-section__label">
          Producers &amp; Decomposer
        </div>
        <PopChart
          popHistory={popHistory}
          arrivedSpecies={arrivedSpecies}
          group="producer"
          height={105}
        />
        <div className="pp-chart-legend">
          {SPECIES_META.filter(s => s.group === 'producer' && arrived(s.id)).map(s => (
            <span key={s.id} className="pp-legend-item">
              <span className="pp-legend-dot" style={{ background: s.color }} />
              <img src={SPRITE_ICONS[s.id]} style={{ width: 14, height: 14, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 2 }} alt={s.id} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Consumers chart */}
      <div className="pp-chart-section">
        <div className="pp-chart-section__label">
          Consumers
        </div>
        <PopChart
          popHistory={popHistory}
          arrivedSpecies={arrivedSpecies}
          group="consumer"
          height={135}
        />
        <div className="pp-chart-legend">
          {SPECIES_META.filter(s => s.group === 'consumer' && arrived(s.id)).map(s => {
            const pop = pops[s.id] ?? 0
            const extinct = pop < 1
            return (
              <span key={s.id} className="pp-legend-item">
                <span className="pp-legend-dot" style={{ background: s.color }} />
                <img src={SPRITE_ICONS[s.id]} style={{ width: 14, height: 14, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 2 }} alt={s.id} />
                {s.name}
                <span className={`pp-legend-pop ${extinct ? 'pp-legend-pop--extinct' : ''}`}>
                  {extinct ? 'EXT' : Math.round(pop)}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Current count bars for all arrived species */}
      <div className="pop-bars-section">
        <div className="pop-bars-section__label">Current counts</div>
        <div className="pop-bars">
          {SPECIES_META.filter(s => arrived(s.id)).map(({ id, name, color }) => {
            const pop = pops[id] ?? 0
            const cap = ALL_K[id] ?? 300
            const pct = Math.min(100, (pop / cap) * 100)
            const extinct = pop < 1
            return (
              <div key={id} className="pop-bar-row">
                <img src={SPRITE_ICONS[id]} className="pop-bar-row__emoji" style={{ imageRendering: 'pixelated' }} alt={id} />
                <span className={`pop-bar-row__name ${extinct ? 'pop-bar-row__name--extinct' : ''}`}>
                  {name}
                </span>
                <div className="pop-bar-row__track">
                  <div
                    className="pop-bar-row__fill"
                    style={{ width: `${pct}%`, background: extinct ? '#6a5a50' : color }}
                  />
                  <div className="pop-bar-row__cap-line" />
                </div>
                <span className="pop-bar-row__val">
                  {extinct ? 'EXTINCT' : Math.round(pop)}
                </span>
                <span className="pop-bar-row__cap">/{cap}</span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
