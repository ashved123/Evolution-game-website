import React from 'react'
import './EcosystemPanel.css'

// Static placeholder food web nodes
const FOOD_WEB = [
  { id: 'hawk',   label: 'Island Hawk',  level: 4, emoji: '🦅', eats: ['deer', 'frog'] },
  { id: 'frog',   label: 'Marsh Frog',   level: 3, emoji: '🐸', eats: ['beetle'] },
  { id: 'deer',   label: 'Leaf Deer',    level: 2, emoji: '🦌', eats: ['grass'] },
  { id: 'beetle', label: 'Rock Beetle',  level: 2, emoji: '🪲', eats: ['grass'] },
  { id: 'grass',  label: 'Island Grass', level: 1, emoji: '🌿', eats: [] },
  { id: 'fungi',  label: 'Fungi',        level: 0, emoji: '🍄', eats: ['grass'] },
]

const LEVEL_LABELS = {
  4: 'Apex predator',
  3: 'Secondary consumer',
  2: 'Primary consumer',
  1: 'Producer (autotroph)',
  0: 'Decomposer',
}

const EVENT_PLACEHOLDER = {
  emoji: '☀️',
  title: 'Calm conditions',
  desc: 'No active events. The island is stable.',
}

export default function EcosystemPanel() {
  return (
    <div className="ecosystem-panel">
      {/* Active event banner */}
      <div className="event-banner pixel-box">
        <span className="section-label">Active Event</span>
        <div className="event-banner__content">
          <span className="event-banner__emoji">{EVENT_PLACEHOLDER.emoji}</span>
          <div>
            <div className="event-banner__title">{EVENT_PLACEHOLDER.title}</div>
            <div className="event-banner__desc">{EVENT_PLACEHOLDER.desc}</div>
          </div>
        </div>
      </div>

      {/* Food web diagram (placeholder SVG) */}
      <div className="food-web pixel-box">
        <span className="section-label">Food Web</span>
        <div className="concept-badge" title="Biology concept">Trophic Levels</div>
        <div className="concept-badge" title="Biology concept">Energy Flow</div>

        <div className="food-web__grid">
          {FOOD_WEB.map(sp => (
            <div key={sp.id} className="food-web__node" style={{ gridRow: 5 - sp.level }}>
              <span className="food-web__emoji">{sp.emoji}</span>
              <span className="food-web__name">{sp.label}</span>
              <span className="food-web__level">{LEVEL_LABELS[sp.level]}</span>
            </div>
          ))}
        </div>

        {/* Population graph placeholder */}
        <div className="pop-graph-placeholder placeholder">
          <span className="placeholder__icon">📈</span>
          <span>Population Graph</span>
          <span style={{ fontSize: '6px', color: '#666' }}>Chart.js goes here</span>
          <div className="concept-badge">Logistic Growth</div>
          <div className="concept-badge">Carrying Capacity</div>
        </div>
      </div>
    </div>
  )
}
