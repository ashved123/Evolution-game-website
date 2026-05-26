import React from 'react'
import './Header.css'
import { getSeason, BREEDING_TICKS } from '../simulation/individuals.js'

const SPEEDS = [0, 1, 2, 4]
const SPEED_LABELS = { 0: 'PAUSE', 1: '1×', 2: '2×', 4: '4×' }

const TABS = [
  { id: 'ecosystem',  label: '🌿 Ecosystem' },
  { id: 'population', label: '📈 Population' },
  { id: 'animals',    label: '🐾 Description' },
  { id: 'species',    label: '📊 Species' },
  { id: 'gene',       label: '🧬 Gene Lab' },
]

// Which animal species are in mating season for a given tick
function breedingNow(tick) {
  const t = ((tick % 12) + 12) % 12
  return Object.entries(BREEDING_TICKS)
    .filter(([, ticks]) => ticks && ticks.includes(t))
    .map(([id]) => id)
}

const SPECIES_EMOJI = { beetle: '🪲', deer: '🦌', frog: '🐸', hawk: '🦅' }

export default function Header({ year, tick = 0, speed, onSpeedChange, activePanel, onTogglePanel, selectedSpecies, islandName, onBackToDashboard }) {
  const season  = getSeason(tick)
  const mating  = breedingNow(tick)

  return (
    <header className="header">

      {/* Brand */}
      <div className="header__brand">
        {onBackToDashboard && (
          <button className="header__back" onClick={onBackToDashboard} title="Back to islands">←</button>
        )}
        <span className="header__icon">🏝</span>
        <span className="header__name">{islandName ?? 'Island of Life'}</span>
        <span className="header__year">Yr <strong>{year}</strong></span>
        <span className="header__season" title={`${season.name}${mating.length ? ' · Breeding: ' + mating.map(id => SPECIES_EMOJI[id]).join(' ') : ''}`}>
          {season.emoji} {season.name}
          {mating.length > 0 && (
            <span className="header__mating">
              {' '}💕 {mating.map(id => SPECIES_EMOJI[id]).join('')}
            </span>
          )}
        </span>
      </div>

      {/* Nav tabs */}
      <nav className="header__nav">
        {TABS.map(({ id, label }) => {
          const isGene    = id === 'gene'
          const disabled  = isGene && !selectedSpecies
          const active    = activePanel === id
          return (
            <button
              key={id}
              className={`nav-tab ${active ? 'nav-tab--active' : ''} ${disabled ? 'nav-tab--disabled' : ''}`}
              onClick={() => !disabled && onTogglePanel(id)}
              title={disabled ? 'Select a species first' : undefined}
            >
              {label}
              {isGene && selectedSpecies && (
                <span className="nav-tab__sub">{selectedSpecies.emoji}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Speed controls */}
      <div className="header__speed">
        {SPEEDS.map(s => (
          <button
            key={s}
            className={`speed-btn ${speed === s ? 'speed-btn--active' : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {SPEED_LABELS[s]}
          </button>
        ))}
      </div>

    </header>
  )
}
