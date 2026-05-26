import React from 'react'
import { EVENTS } from '../simulation/engine.js'
import './EcosystemPanel.css'

const FOOD_WEB = [
  { id: 'hawk',   label: 'Island Hawk',  level: 4, emoji: '🦅', eats: ['deer', 'frog'] },
  { id: 'frog',   label: 'Marsh Frog',   level: 3, emoji: '🐸', eats: ['beetle'] },
  { id: 'deer',   label: 'Leaf Deer',    level: 2, emoji: '🦌', eats: ['grass', 'tree'] },
  { id: 'beetle', label: 'Rock Beetle',  level: 2, emoji: '🪲', eats: ['grass', 'tree'] },
  { id: 'tree',   label: 'Island Fig',   level: 1, emoji: '🌳', eats: [], renewable: true },
  { id: 'grass',  label: 'Island Grass', level: 1, emoji: '🌿', eats: [] },
  { id: 'fungi',  label: 'Shelf Fungi',  level: 0, emoji: '🍄', eats: ['dead matter'] },
]

const LEVEL_LABELS = {
  4: 'Apex predator',
  3: 'Secondary consumer',
  2: 'Primary consumer',
  1: 'Producer (autotroph)',
  0: 'Decomposer',
}

const CALM = { emoji: '☀️', title: 'Calm conditions', desc: 'No active events. The island is stable.', concept: null }

export default function EcosystemPanel({ event, log = [], deadMatter = 0 }) {
  const activeDef = event ? EVENTS[event.id] : null
  const display   = activeDef
    ? { emoji: activeDef.emoji, title: activeDef.title, desc: activeDef.desc, concept: activeDef.concept }
    : CALM

  return (
    <div className="ecosystem-panel">

      {/* Active event banner */}
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

      {/* Dead matter readout */}
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
        <div className="dead-matter__hint">Fungi consume dead matter → nutrients → producer growth</div>
      </div>

      {/* Food web diagram */}
      <div className="food-web pixel-box">
        <span className="section-label">Food Web</span>
        <div className="food-web__badges">
          <span className="concept-badge">Trophic Levels</span>
          <span className="concept-badge">Energy Flow</span>
          <span className="concept-badge">Autotrophs / Heterotrophs</span>
        </div>
        <div className="food-web__grid">
          {FOOD_WEB.map(sp => (
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
