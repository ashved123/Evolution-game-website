import React from 'react'
import { K } from '../simulation/engine.js'
import './PopulationPanel.css'

const SPECIES_DISPLAY = [
  { id: 'grass',  emoji: '🌿', name: 'Island Grass', color: '#4caf50' },
  { id: 'tree',   emoji: '🌳', name: 'Island Fig',   color: '#2e7d32' },
  { id: 'beetle', emoji: '🪲', name: 'Rock Beetle',  color: '#8d6e63' },
  { id: 'deer',   emoji: '🦌', name: 'Leaf Deer',    color: '#a5d6a7' },
  { id: 'frog',   emoji: '🐸', name: 'Marsh Frog',   color: '#66bb6a' },
  { id: 'hawk',   emoji: '🦅', name: 'Island Hawk',  color: '#ff7043' },
  { id: 'fungi',  emoji: '🍄', name: 'Shelf Fungi',  color: '#ce93d8' },
]

export default function PopulationPanel({ pops = {} }) {
  return (
    <div className="pop-panel">
      <div className="pop-panel__header">
        <span className="section-label">Population Dynamics</span>
        <div>
          <span className="concept-badge">Logistic Growth</span>
          <span className="concept-badge">Carrying Capacity</span>
          <span className="concept-badge">Predator-Prey</span>
        </div>
      </div>

      <div className="pop-bars">
        {SPECIES_DISPLAY.map(({ id, emoji, name, color }) => {
          const pop = pops[id] ?? 0
          const cap = K[id] ?? 300
          const pct = Math.min(100, (pop / cap) * 100)
          const extinct = pop < 1
          return (
            <div key={id} className="pop-bar-row">
              <span className="pop-bar-row__emoji">{emoji}</span>
              <span className={`pop-bar-row__name ${extinct ? 'pop-bar-row__name--extinct' : ''}`}>
                {name}
              </span>
              <div className="pop-bar-row__track">
                <div
                  className="pop-bar-row__fill"
                  style={{ width: `${pct}%`, background: extinct ? '#6a5a50' : color }}
                />
                {/* Carrying capacity marker */}
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

      <div className="pop-panel__legend-hint">
        Bar = current pop · Line = carrying capacity (K)
      </div>
    </div>
  )
}
