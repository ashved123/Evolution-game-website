import React from 'react'
import { EVENTS, K } from '../simulation/engine.js'
import './EcosystemPanel.css'

const FOOD_WEB = [
  { id: 'hawk',    label: 'Island Hawk',  level: 4, emoji: '🦅', eats: ['deer', 'frog'] },
  { id: 'monitor', label: 'Monitor',      level: 3, emoji: '🦎', eats: ['frog', 'beetle'] },
  { id: 'boar',    label: 'Wild Boar',    level: 3, emoji: '🐗', eats: ['grass', 'tree', 'beetle'] },
  { id: 'frog',    label: 'Marsh Frog',   level: 3, emoji: '🐸', eats: ['beetle'] },
  { id: 'deer',    label: 'Leaf Deer',    level: 2, emoji: '🦌', eats: ['grass', 'tree'] },
  { id: 'beetle',  label: 'Rock Beetle',  level: 2, emoji: '🪲', eats: ['grass', 'tree'] },
  { id: 'tree',    label: 'Island Fig',   level: 1, emoji: '🌳', eats: [], renewable: true },
  { id: 'grass',   label: 'Island Grass', level: 1, emoji: '🌿', eats: [] },
  { id: 'fungi',   label: 'Shelf Fungi',  level: 0, emoji: '🍄', eats: ['dead matter'] },
]

const LEVEL_LABELS = {
  4: 'Apex predator',
  3: 'Secondary consumer',
  2: 'Primary consumer',
  1: 'Producer',
  0: 'Decomposer',
}

const POP_DISPLAY = [
  { id: 'grass',   emoji: '🌿', color: '#4caf50' },
  { id: 'tree',    emoji: '🌳', color: '#2e7d32' },
  { id: 'fungi',   emoji: '🍄', color: '#ce93d8' },
  { id: 'beetle',  emoji: '🪲', color: '#8d6e63' },
  { id: 'deer',    emoji: '🦌', color: '#a5d6a7' },
  { id: 'frog',    emoji: '🐸', color: '#66bb6a' },
  { id: 'boar',    emoji: '🐗', color: '#bf8a50' },
  { id: 'monitor', emoji: '🦎', color: '#78909c' },
  { id: 'hawk',    emoji: '🦅', color: '#ff7043' },
]

const CALM = { emoji: '☀️', title: 'Calm conditions', desc: 'No active events. The island is stable.', concept: null }

export default function EcosystemPanel({ event, log = [], deadMatter = 0, pops = {}, arrivedSpecies }) {
  const activeDef = event ? EVENTS[event.id] : null
  const display   = activeDef
    ? { emoji: activeDef.emoji, title: activeDef.title, desc: activeDef.desc, concept: activeDef.concept }
    : CALM

  return (
    <div className="ecosystem-panel">

      {/* Active event */}
      <div className={`event-banner pixel-box ${activeDef ? 'event-banner--active' : ''}`}>
        <span className="section-label">Active Event</span>
        <div className="event-banner__content">
          <span className="event-banner__emoji">{display.emoji}</span>
          <div>
            <div className="event-banner__title">{display.title}</div>
            <div className="event-banner__desc">{display.desc}</div>
          </div>
        </div>
        {activeDef && (
          <div className="event-banner__meta">
            <span className="concept-badge">{display.concept}</span>
            <span className="event-banner__ticks">{event.ticksLeft} ticks left</span>
          </div>
        )}
      </div>

      {/* Population bars */}
      <div className="eco-pops pixel-box">
        <div className="eco-pops__header">
          <span className="section-label">Populations</span>
          <span className="concept-badge">Carrying Capacity</span>
          <span className="concept-badge">Logistic Growth</span>
        </div>
        {POP_DISPLAY.filter(({ id }) => !arrivedSpecies || arrivedSpecies.has(id)).map(({ id, emoji, color }) => {
          const pop = pops[id] ?? 0
          const cap = K[id] ?? 300
          const pct = Math.min(100, (pop / cap) * 100)
          const extinct = pop < 1
          return (
            <div key={id} className="eco-pop-row">
              <span className="eco-pop-row__emoji">{emoji}</span>
              <div className="eco-pop-row__track">
                <div
                  className="eco-pop-row__fill"
                  style={{ width: `${pct}%`, background: extinct ? '#6a5a50' : color }}
                />
                <div className="eco-pop-row__cap-line" />
              </div>
              <span className={`eco-pop-row__val ${extinct ? 'eco-pop-row__val--extinct' : ''}`}>
                {extinct ? 'EXT' : Math.round(pop)}
              </span>
              <span className="eco-pop-row__cap">/{cap}</span>
            </div>
          )
        })}
        <div className="eco-pops__hint">Bar = current · Line = carrying capacity K</div>
      </div>

      {/* Dead matter */}
      <div className="dead-matter pixel-box">
        <span className="section-label">Dead Matter</span>
        <div className="dead-matter__row">
          <span className="dead-matter__icon">💀</span>
          <div className="dead-matter__bar">
            <div className="dead-matter__fill" style={{ width: `${Math.min(100, deadMatter / 6)}%` }} />
          </div>
          <span className="dead-matter__val">{Math.round(deadMatter)}</span>
          <span className="concept-badge">Decomposition</span>
        </div>
        <div className="dead-matter__hint">Fungi break down dead matter → nutrients → producer growth</div>
      </div>

      {/* Food web */}
      <div className="food-web pixel-box">
        <span className="section-label">Food Web</span>
        <div className="food-web__badges">
          <span className="concept-badge">Trophic Levels</span>
          <span className="concept-badge">Energy Flow</span>
          <span className="concept-badge">Autotrophs / Heterotrophs</span>
        </div>
        <div className="food-web__grid">
          {FOOD_WEB.filter(sp => !arrivedSpecies || arrivedSpecies.has(sp.id)).map(sp => (
            <div
              key={sp.id}
              className={`food-web__node ${sp.renewable ? 'food-web__node--renewable' : ''}`}
              style={{ gridRow: 5 - sp.level }}
            >
              <span className="food-web__emoji">{sp.emoji}</span>
              <span className="food-web__name">{sp.label}</span>
              <span className="food-web__level">{LEVEL_LABELS[sp.level]}</span>
              {sp.renewable && <span className="food-web__renew">♻ renewable</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Event log */}
      {log.length > 0 && (
        <div className="event-log pixel-box">
          <span className="section-label">Event Log</span>
          <div className="event-log__rows">
            {log.map((entry, i) => (
              <div key={i} className="event-log__row">
                <span className="event-log__emoji">{entry.emoji}</span>
                <span className="event-log__title">{entry.title}</span>
                <span className="event-log__year">Yr {entry.year}</span>
                {entry.concept && <span className="concept-badge">{entry.concept}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
