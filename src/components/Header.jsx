import React from 'react'
import './Header.css'

const TABS = [
  { id: 'clock',     label: '⏱ Time' },
  { id: 'events',    label: '📋 Events' },
  { id: 'ecosystem', label: '🌍 Ecosystem' },
  { id: 'species',   label: '🐾 Species' },
  { id: 'gene',      label: '🧬 Gene Lab' },
]

export default function Header({ year, islandName, onBackToDashboard, wins = {}, onToggleWin, onOpenTutorial }) {
  return (
    <>
      <header className="header">

        <div className="header__brand">
          {onBackToDashboard && (
            <button className="header__back" onClick={onBackToDashboard} title="Back to islands">←</button>
          )}
          <span className="header__icon">🏝</span>
          <span className="header__name">{islandName ?? 'Island of Life'}</span>
          <span className="header__year">Yr <strong>{year}</strong></span>
          <button className="header__tut-btn" onClick={onOpenTutorial} title="Open tutorial">?</button>
        </div>

        <nav className="header__nav">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              data-tut={`tab-${id}`}
              className={`nav-tab ${wins[id]?.open ? 'nav-tab--active' : ''}`}
              onClick={() => onToggleWin?.(id)}
            >
              {label}
            </button>
          ))}
        </nav>

      </header>
    </>
  )
}
